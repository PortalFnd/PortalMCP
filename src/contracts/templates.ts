/**
 * Contract templates for common Ethereum standards
 */

/**
 * Generate an ERC-20 token contract
 */
export function getERC20Template(
  name: string,
  symbol: string,
  initialSupply: string,
  decimals: number = 18
): string {
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ${name.replace(/\s+/g, '')} is ERC20, Ownable {
    uint8 private _decimals;

    constructor() ERC20("${name}", "${symbol}") Ownable(msg.sender) {
        _decimals = ${decimals};
        _mint(msg.sender, ${initialSupply} * 10**${decimals});
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
    
    function burn(address from, uint256 amount) public onlyOwner {
        _burn(from, amount);
    }
}`;
}

/**
 * Generate an ERC-721 NFT contract
 */
export function getERC721Template(
  name: string,
  symbol: string,
  baseURI: string = ""
): string {
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ${name.replace(/\s+/g, '')} is ERC721Enumerable, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;
    string private _baseTokenURI;

    constructor() ERC721("${name}", "${symbol}") Ownable(msg.sender) {
        _baseTokenURI = "${baseURI}";
    }
    
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
    
    function setBaseURI(string memory baseURI) public onlyOwner {
        _baseTokenURI = baseURI;
    }
    
    function safeMint(address to, uint256 tokenId, string memory uri) public onlyOwner {
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }
    
    function mint(address to, uint256 tokenId) public onlyOwner {
        _safeMint(to, tokenId);
    }
    
    function mintWithURI(address to, string memory uri) public onlyOwner returns (uint256) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }
    
    // The following functions are overrides required by Solidity
    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721Enumerable, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}`;
}

/**
 * Generate a simple staking contract for ERC-20 tokens
 */
export function getStakingContractTemplate(
  name: string,
  tokenAddress: string,
  rewardRate: string
): string {
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ${name.replace(/\s+/g, '')}Staking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public stakingToken;
    uint256 public rewardRate = ${rewardRate}; // Rewards per second per token staked
    
    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 rewardDebt;
    }
    
    mapping(address => StakeInfo) public stakes;
    uint256 public totalStaked = 0;
    
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    
    constructor() Ownable(msg.sender) {
        stakingToken = IERC20(${tokenAddress});
    }
    
    function setRewardRate(uint256 _rewardRate) external onlyOwner {
        rewardRate = _rewardRate;
    }
    
    function pendingRewards(address user) public view returns (uint256) {
        StakeInfo storage stakeInfo = stakes[user];
        if (stakeInfo.amount == 0) {
            return 0;
        }
        
        uint256 duration = block.timestamp - stakeInfo.startTime;
        uint256 reward = (stakeInfo.amount * rewardRate * duration) / 1e18;
        return reward - stakeInfo.rewardDebt;
    }
    
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot stake 0");
        
        // Update rewards first if already staking
        if (stakes[msg.sender].amount > 0) {
            uint256 reward = pendingRewards(msg.sender);
            if (reward > 0) {
                stakingToken.safeTransfer(msg.sender, reward);
                emit RewardPaid(msg.sender, reward);
            }
        }
        
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        
        stakes[msg.sender].amount += amount;
        stakes[msg.sender].startTime = block.timestamp;
        stakes[msg.sender].rewardDebt = 0;
        
        totalStaked += amount;
        
        emit Staked(msg.sender, amount);
    }
    
    function withdraw(uint256 amount) external nonReentrant {
        StakeInfo storage stakeInfo = stakes[msg.sender];
        require(stakeInfo.amount >= amount, "Not enough staked");
        
        // Calculate rewards
        uint256 reward = pendingRewards(msg.sender);
        
        // Update stake info
        stakeInfo.amount -= amount;
        stakeInfo.startTime = block.timestamp;
        stakeInfo.rewardDebt = 0;
        
        totalStaked -= amount;
        
        // Transfer tokens back to user
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
        
        // Transfer rewards
        if (reward > 0) {
            stakingToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }
    
    function claimRewards() external nonReentrant {
        uint256 reward = pendingRewards(msg.sender);
        require(reward > 0, "No rewards to claim");
        
        stakes[msg.sender].startTime = block.timestamp;
        stakes[msg.sender].rewardDebt = 0;
        
        stakingToken.safeTransfer(msg.sender, reward);
        emit RewardPaid(msg.sender, reward);
    }
    
    function emergencyWithdraw() external nonReentrant {
        StakeInfo storage stakeInfo = stakes[msg.sender];
        require(stakeInfo.amount > 0, "Nothing to withdraw");
        
        uint256 amount = stakeInfo.amount;
        totalStaked -= amount;
        
        delete stakes[msg.sender];
        
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }
}`;
}
