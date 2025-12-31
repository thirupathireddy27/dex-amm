// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";



contract DEX is ReentrancyGuard {
    // Token addresses
    address public tokenA;
    address public tokenB;

    // Reserves
    uint256 public reserveA;
    uint256 public reserveB;

    // Liquidity tracking
    uint256 public totalLiquidity;
    mapping(address => uint256) public liquidity;

    // Events (as required)
    event LiquidityAdded(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidityMinted
    );

    event LiquidityRemoved(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidityBurned
    );

    event Swap(
        address indexed trader,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    /// @notice Initialize the DEX with two token addresses
    /// @param _tokenA Address of first token
    /// @param _tokenB Address of second token
    constructor(address _tokenA, address _tokenB) {
        require(_tokenA != address(0) && _tokenB != address(0), "Invalid token address");
        require(_tokenA != _tokenB, "Tokens must be different");

        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    function addLiquidity(uint256 amountA, uint256 amountB)
    external
    nonReentrant
    returns (uint256 liquidityMinted)
{
    require(amountA > 0 && amountB > 0, "Zero amount");

    // Transfer tokens from user to DEX
    IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
    IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);

    if (totalLiquidity == 0) {
        // First liquidity provider
        liquidityMinted = _sqrt(amountA * amountB);
    } else {
        // Enforce ratio
        require(
            amountB == (amountA * reserveB) / reserveA,
            "Ratio mismatch"
        );
        liquidityMinted = (amountA * totalLiquidity) / reserveA;
    }

    require(liquidityMinted > 0, "Zero liquidity minted");

    // Update liquidity balances
    liquidity[msg.sender] += liquidityMinted;
    totalLiquidity += liquidityMinted;

    // Update reserves
    reserveA += amountA;
    reserveB += amountB;

    emit LiquidityAdded(msg.sender, amountA, amountB, liquidityMinted);
}


function _sqrt(uint256 y) internal pure returns (uint256 z) {
    if (y > 3) {
        z = y;
        uint256 x = y / 2 + 1;
        while (x < z) {
            z = x;
            x = (y / x + x) / 2;
        }
    } else if (y != 0) {
        z = 1;
    }
}


function removeLiquidity(uint256 liquidityAmount)
    external
    nonReentrant
    returns (uint256 amountA, uint256 amountB)
{
    require(liquidityAmount > 0, "Zero liquidity");
    require(liquidity[msg.sender] >= liquidityAmount, "Not enough liquidity");

    amountA = (liquidityAmount * reserveA) / totalLiquidity;
    amountB = (liquidityAmount * reserveB) / totalLiquidity;

    require(amountA > 0 && amountB > 0, "Zero withdrawal");

    // Update liquidity balances
    liquidity[msg.sender] -= liquidityAmount;
    totalLiquidity -= liquidityAmount;

    // Update reserves
    reserveA -= amountA;
    reserveB -= amountB;

    // Transfer tokens back to user
    IERC20(tokenA).transfer(msg.sender, amountA);
    IERC20(tokenB).transfer(msg.sender, amountB);

    emit LiquidityRemoved(msg.sender, amountA, amountB, liquidityAmount);
}


function getAmountOut(
    uint256 amountIn,
    uint256 reserveIn,
    uint256 reserveOut
) public pure returns (uint256 amountOut) {
    require(amountIn > 0, "Zero input");
    require(reserveIn > 0 && reserveOut > 0, "Empty reserves");

    uint256 amountInWithFee = amountIn * 997;
    uint256 numerator = amountInWithFee * reserveOut;
    uint256 denominator = (reserveIn * 1000) + amountInWithFee;

    amountOut = numerator / denominator;
}


function swapAForB(uint256 amountAIn)
    external
    nonReentrant
    returns (uint256 amountBOut)
{
    require(amountAIn > 0, "Zero swap");

    // Transfer token A from user
    IERC20(tokenA).transferFrom(msg.sender, address(this), amountAIn);

    amountBOut = getAmountOut(amountAIn, reserveA, reserveB);
    require(amountBOut > 0, "Zero output");

    // Update reserves
    reserveA += amountAIn;
    reserveB -= amountBOut;

    // Transfer token B to user
    IERC20(tokenB).transfer(msg.sender, amountBOut);

    emit Swap(msg.sender, tokenA, tokenB, amountAIn, amountBOut);
}


function swapBForA(uint256 amountBIn)
    external
    nonReentrant
    returns (uint256 amountAOut)
{
    require(amountBIn > 0, "Zero swap");

    // Transfer token B from user
    IERC20(tokenB).transferFrom(msg.sender, address(this), amountBIn);

    amountAOut = getAmountOut(amountBIn, reserveB, reserveA);
    require(amountAOut > 0, "Zero output");

    // Update reserves
    reserveB += amountBIn;
    reserveA -= amountAOut;

    // Transfer token A to user
    IERC20(tokenA).transfer(msg.sender, amountAOut);

    emit Swap(msg.sender, tokenB, tokenA, amountBIn, amountAOut);
}

function getPrice() external view returns (uint256 price) {
    if (reserveA == 0 || reserveB == 0) {
        return 0;
    }
    price = reserveB / reserveA;
}


function getReserves()
    external
    view
    returns (uint256 _reserveA, uint256 _reserveB)
{
    _reserveA = reserveA;
    _reserveB = reserveB;
}


}


