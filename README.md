# DEX AMM Project

## Overview
This project implements a simplified Decentralized Exchange (DEX) using the
Automated Market Maker (AMM) model similar to Uniswap V2. It allows users to
add and remove liquidity, swap between two ERC-20 tokens, and earn trading
fees as liquidity providers without relying on centralized intermediaries.

## Features
- Initial and subsequent liquidity provision
- LP token minting and burning
- Token swaps using constant product formula (x * y = k)
- 0.3% trading fee distributed to liquidity providers
- Dynamic price calculation based on pool reserves
- Extensive test coverage with edge case handling
- Docker-based reproducible environment

## Architecture
The system consists of a core DEX smart contract responsible for managing
liquidity pools, LP accounting, and swap logic. A MockERC20 contract is used
for testing and simulation. All interactions are permissionless and executed
on-chain.

## Mathematical Implementation

### Constant Product Formula
The AMM follows the invariant:

x * y = k

Where:
- x = reserve of Token A
- y = reserve of Token B
- k = constant product

### Fee Calculation
A 0.3% fee is applied to every swap:

amountInWithFee = amountIn * 997 / 1000

The fee remains in the pool, increasing k and benefiting liquidity providers.

### LP Token Minting
Initial liquidity:
liquidityMinted = sqrt(amountA * amountB)

Subsequent liquidity:
liquidityMinted = (amountA * totalLiquidity) / reserveA

## Setup Instructions

### Using Docker
```bash
docker-compose up -d
docker-compose exec app npm test
docker-compose down
```

### Running Locally
```bash
npm install
npx hardhat compile
npx hardhat test
npx hardhat coverage
```

## Contract Addresses
This project is not deployed to a public testnet. All contracts are tested
locally using Hardhat.

## Known Limitations
- Only a single token pair is supported
- No slippage protection or transaction deadlines
- No flash swaps or multi-hop trades

## Security Considerations
- Solidity 0.8+ overflow protection
- Reentrancy-safe state updates
- Input validation for zero and invalid amounts
- Fee applied before swap calculation
    