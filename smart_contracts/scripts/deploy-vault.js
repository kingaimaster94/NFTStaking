const hre = require("hardhat");
const fs = require('fs');
const fse = require("fs-extra");
const { verify } = require('../utils/verify')
const { getAmountInWei, developmentChains } = require('../utils/helper-scripts');


async function main() {
  const deployNetwork = hre.network.name

  // test URI
  const baseURI = "ipfs://QmeHfivPyobBjSXtVUv2VHCMmugDRfZ7Qv7QfkrG4BWLQz"

  const maxSupply = 30
  const mintCost = getAmountInWei(0.01)
  const maxMintAmount = 5

  // Deploy KryptoNFT contract 
  const NFTContract = await ethers.getContractFactory("KryptoNFT");
  const nftContract = await NFTContract.deploy(maxSupply, mintCost, maxMintAmount);

  await nftContract.deployed();

  const set_tx = await nftContract.setBaseURI(baseURI)
  await set_tx.wait()

  // Deploy KryptoNFT ERC20 token contract 
  const TokenContract = await ethers.getContractFactory("KryptoNFTToken");
  const tokenContract = await TokenContract.deploy();

  await tokenContract.deployed();

  // Deploy NFTStakingVault contract 
  const Vault = await ethers.getContractFactory("NFTStakingVault");
  const stakingVault = await Vault.deploy(nftContract.address, tokenContract.address);

  await stakingVault.deployed();

  const control_tx = await tokenContract.setController(stakingVault.address, true)
  await control_tx.wait()

  console.log("KryptoNFT contract deployed at:\n", nftContract.address);
  console.log("KryptoNFT ERC20 token contract deployed at:\n", tokenContract.address);
  console.log("NFT Staking Vault deployed at:\n", stakingVault.address);
  console.log("Network deployed to :\n", deployNetwork);

  /* transfer contracts addresses & ABIs to the front-end */
  if (fs.existsSync("../front-end/src")) {
    fs.rmSync("../src/contracts", { recursive: true, force: true });
    fse.copySync("./artifacts/contracts", "../front-end/src/contracts")
    fs.writeFileSync("../front-end/src/utils/contracts-config.js", `
      export const stakingContractAddress = "${stakingVault.address}"
      export const nftContractAddress = "${nftContract.address}"
      export const tokenContractAddress = "${tokenContract.address}"
      export const ownerAddress = "${stakingVault.signer.address}"
      export const networkDeployedTo = "${hre.network.config.chainId}"
    `)
  }

  if (!developmentChains.includes(deployNetwork) && hre.config.etherscan.apiKey) {
    console.log("waiting for 6 blocks verification ...")
    await stakingVault.deployTransaction.wait(6)

    // args represent contract constructor arguments
    const args = [nftContract.address, tokenContract.address]
    await verify(stakingVault.address, args)
  }
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
