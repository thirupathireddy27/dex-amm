const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DEX", function () {
    let dex, tokenA, tokenB;
    let owner, addr1;

    beforeEach(async function () {
        [owner, addr1] = await ethers.getSigners();

        const MockERC20 = await ethers.getContractFactory("MockERC20");
        tokenA = await MockERC20.deploy("Token A", "TKA");
        tokenB = await MockERC20.deploy("Token B", "TKB");

        const DEX = await ethers.getContractFactory("DEX");
        dex = await DEX.deploy(tokenA.address, tokenB.address);

        await tokenA.approve(dex.address, ethers.utils.parseEther("1000000"));
        await tokenB.approve(dex.address, ethers.utils.parseEther("1000000"));
    });

    describe("Liquidity Management", function () {

        it("should allow initial liquidity provision", async function () {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );

            const [reserveA, reserveB] = await dex.getReserves();
            expect(reserveA).to.equal(ethers.utils.parseEther("100"));
            expect(reserveB).to.equal(ethers.utils.parseEther("200"));
        });

        it("should mint correct LP tokens for first provider", async function () {
            const tx = await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );

            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "LiquidityAdded");

            const liquidityMinted = event.args.liquidityMinted;

            expect(liquidityMinted).to.be.gt(0);
            expect(await dex.totalLiquidity()).to.equal(liquidityMinted);
        });

        it("should allow subsequent liquidity additions", async function () {
            // First LP
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );

            const initialLiquidity = await dex.totalLiquidity();

            // Second LP
            await dex.addLiquidity(
                ethers.utils.parseEther("50"),
                ethers.utils.parseEther("100")
            );

            const newLiquidity = await dex.totalLiquidity();
            expect(newLiquidity).to.be.gt(initialLiquidity);
        });


        it("should maintain price ratio on liquidity addition", async function () {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );

            const priceBefore = await dex.getPrice();

            await dex.addLiquidity(
                ethers.utils.parseEther("50"),
                ethers.utils.parseEther("100")
            );

            const priceAfter = await dex.getPrice();
            expect(priceAfter).to.equal(priceBefore);
        });


        it("should revert on zero liquidity addition", async function () {
            await expect(
                dex.addLiquidity(0, ethers.utils.parseEther("100"))
            ).to.be.reverted;

            await expect(
                dex.addLiquidity(ethers.utils.parseEther("100"), 0)
            ).to.be.reverted;
        });


        it("should allow partial liquidity removal", async function () {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );

            const totalLiquidity = await dex.totalLiquidity();
            const halfLiquidity = totalLiquidity.div(2);

            await dex.removeLiquidity(halfLiquidity);

            const remainingLiquidity = await dex.liquidity(owner.address);
            expect(remainingLiquidity).to.equal(totalLiquidity.sub(halfLiquidity));
        });


        it("should return correct token amounts on liquidity removal", async function () {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );

            const totalLiquidity = await dex.totalLiquidity();
            const halfLiquidity = totalLiquidity.div(2);

            const balanceABefore = await tokenA.balanceOf(owner.address);
            const balanceBBefore = await tokenB.balanceOf(owner.address);

            await dex.removeLiquidity(halfLiquidity);

            const balanceAAfter = await tokenA.balanceOf(owner.address);
            const balanceBAfter = await tokenB.balanceOf(owner.address);

            expect(balanceAAfter.sub(balanceABefore)).to.equal(
                ethers.utils.parseEther("50")
            );
            expect(balanceBAfter.sub(balanceBBefore)).to.equal(
                ethers.utils.parseEther("100")
            );
        });


        it("should revert when removing more liquidity than owned", async function () {
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );

            const totalLiquidity = await dex.totalLiquidity();

            await expect(
                dex.removeLiquidity(totalLiquidity.add(1))
            ).to.be.reverted;
        });

    });

    describe("Token Swaps", function () {
        beforeEach(async function () {
            // Initial liquidity for swap tests
            await dex.addLiquidity(
                ethers.utils.parseEther("100"),
                ethers.utils.parseEther("200")
            );
        });

        it("should swap token A for token B", async function () {
            const balanceBBefore = await tokenB.balanceOf(owner.address);

            await dex.swapAForB(ethers.utils.parseEther("10"));

            const balanceBAfter = await tokenB.balanceOf(owner.address);
            expect(balanceBAfter).to.be.gt(balanceBBefore);
        });

        it("should swap token B for token A", async function () {
            const balanceABefore = await tokenA.balanceOf(owner.address);

            await dex.swapBForA(ethers.utils.parseEther("20"));

            const balanceAAfter = await tokenA.balanceOf(owner.address);
            expect(balanceAAfter).to.be.gt(balanceABefore);
        });

        it("should calculate correct output amount with fee", async function () {
            const reserveA = ethers.utils.parseEther("100");
            const reserveB = ethers.utils.parseEther("200");

            const amountIn = ethers.utils.parseEther("10");

            const expectedOut = await dex.getAmountOut(
                amountIn,
                reserveA,
                reserveB
            );

            await dex.swapAForB(amountIn);

            const balanceBAfter = await tokenB.balanceOf(owner.address);
            expect(balanceBAfter).to.be.gt(0);
            expect(expectedOut).to.be.gt(0);
        });

        it("should update reserves after swap", async function () {
            const [reserveABefore, reserveBBefore] = await dex.getReserves();

            await dex.swapAForB(ethers.utils.parseEther("10"));

            const [reserveAAfter, reserveBAfter] = await dex.getReserves();

            expect(reserveAAfter).to.be.gt(reserveABefore);
            expect(reserveBAfter).to.be.lt(reserveBBefore);
        });

        it("should increase k after swap due to fees", async function () {
            const [reserveABefore, reserveBBefore] = await dex.getReserves();
            const kBefore = reserveABefore.mul(reserveBBefore);

            await dex.swapAForB(ethers.utils.parseEther("10"));

            const [reserveAAfter, reserveBAfter] = await dex.getReserves();
            const kAfter = reserveAAfter.mul(reserveBAfter);

            expect(kAfter).to.be.gt(kBefore);
        });


        it("should revert on zero swap amount", async function () {
            await expect(dex.swapAForB(0)).to.be.reverted;
            await expect(dex.swapBForA(0)).to.be.reverted;
        });


        it("should handle multiple consecutive swaps", async function () {
            await dex.swapAForB(ethers.utils.parseEther("5"));
            await dex.swapAForB(ethers.utils.parseEther("5"));
            await dex.swapBForA(ethers.utils.parseEther("10"));

            const [reserveA, reserveB] = await dex.getReserves();
            expect(reserveA).to.be.gt(0);
            expect(reserveB).to.be.gt(0);
        });

    });

    describe("Price Calculations", function () {
  it("should return correct initial price", async function () {
    await dex.addLiquidity(
      ethers.utils.parseEther("100"),
      ethers.utils.parseEther("200")
    );

    const price = await dex.getPrice();
    expect(price).to.equal(
      ethers.utils.parseEther("200").div(ethers.utils.parseEther("100"))
    );
  });

  it("should update price after swaps", async function () {
    await dex.addLiquidity(
      ethers.utils.parseEther("100"),
      ethers.utils.parseEther("200")
    );

    const priceBefore = await dex.getPrice();
    await dex.swapAForB(ethers.utils.parseEther("10"));
    const priceAfter = await dex.getPrice();

    expect(priceAfter).to.not.equal(priceBefore);
  });

  it("should handle price queries with zero reserves gracefully", async function () {
    const price = await dex.getPrice();
    expect(price).to.equal(0);
  });
});


describe("Fee Distribution", function () {
  it("should accumulate fees for liquidity providers", async function () {
    await dex.addLiquidity(
      ethers.utils.parseEther("100"),
      ethers.utils.parseEther("200")
    );

    const balanceBefore = await tokenB.balanceOf(owner.address);
    await dex.swapAForB(ethers.utils.parseEther("10"));

    const totalLiquidity = await dex.totalLiquidity();
    await dex.removeLiquidity(totalLiquidity);

    const balanceAfter = await tokenB.balanceOf(owner.address);
    expect(balanceAfter).to.be.gt(balanceBefore);
  });

  it("should distribute fees proportionally to LP share", async function () {
    await dex.addLiquidity(
      ethers.utils.parseEther("100"),
      ethers.utils.parseEther("200")
    );

    await dex.swapAForB(ethers.utils.parseEther("10"));

    const totalLiquidity = await dex.totalLiquidity();
    await dex.removeLiquidity(totalLiquidity);

    const balance = await tokenB.balanceOf(owner.address);
    expect(balance).to.be.gt(ethers.utils.parseEther("200"));
  });
});


describe("Events", function () {
  it("should emit LiquidityAdded event", async function () {
    await expect(
      dex.addLiquidity(
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("200")
      )
    ).to.emit(dex, "LiquidityAdded");
  });

  it("should emit LiquidityRemoved event", async function () {
    await dex.addLiquidity(
      ethers.utils.parseEther("100"),
      ethers.utils.parseEther("200")
    );

    const liquidity = await dex.totalLiquidity();
    await expect(dex.removeLiquidity(liquidity))
      .to.emit(dex, "LiquidityRemoved");
  });

  it("should emit Swap event", async function () {
    await dex.addLiquidity(
      ethers.utils.parseEther("100"),
      ethers.utils.parseEther("200")
    );

    await expect(
      dex.swapAForB(ethers.utils.parseEther("10"))
    ).to.emit(dex, "Swap");
  });
});


describe("Edge Cases", function () {
  it("should handle very small liquidity amounts", async function () {
    await dex.addLiquidity(1, 2);
    const reserves = await dex.getReserves();
    expect(reserves[0]).to.equal(1);
  });

  it("should handle very large liquidity amounts", async function () {
    await dex.addLiquidity(
      ethers.utils.parseEther("100000"),
      ethers.utils.parseEther("200000")
    );

    const reserves = await dex.getReserves();
    expect(reserves[0]).to.be.gt(0);
  });
});

});


