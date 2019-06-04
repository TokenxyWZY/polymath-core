const PolymathRegistry = artifacts.require("./PolymathRegistry.sol");
const GeneralTransferManagerFactory = artifacts.require("./GeneralTransferManagerFactory.sol");
const GeneralTransferManagerLogic = artifacts.require("./GeneralTransferManager.sol");
const GeneralPermissionManagerLogic = artifacts.require("./GeneralPermissionManager.sol");
const GeneralPermissionManagerFactory = artifacts.require("./GeneralPermissionManagerFactory.sol");
const PercentageTransferManagerLogic = artifacts.require("./PercentageTransferManager.sol");
const PercentageTransferManagerFactory = artifacts.require("./PercentageTransferManagerFactory.sol");
const USDTieredSTOLogic = artifacts.require("./USDTieredSTO.sol");
const CountTransferManagerFactory = artifacts.require("./CountTransferManagerFactory.sol");
const CountTransferManagerLogic = artifacts.require("./CountTransferManager.sol");
const EtherDividendCheckpointLogic = artifacts.require("./EtherDividendCheckpoint.sol");
const ERC20DividendCheckpointLogic = artifacts.require("./ERC20DividendCheckpoint.sol");
const EtherDividendCheckpointFactory = artifacts.require("./EtherDividendCheckpointFactory.sol");
const ERC20DividendCheckpointFactory = artifacts.require("./ERC20DividendCheckpointFactory.sol");
const ModuleRegistry = artifacts.require("./ModuleRegistry.sol");
const ModuleRegistryProxy = artifacts.require("./ModuleRegistryProxy.sol");
const ManualApprovalTransferManagerFactory = artifacts.require("./ManualApprovalTransferManagerFactory.sol");
const ManualApprovalTransferManagerLogic = artifacts.require("./ManualApprovalTransferManager.sol");
const CappedSTOFactory = artifacts.require("./CappedSTOFactory.sol");
const CappedSTOLogic = artifacts.require("./CappedSTO.sol");
const USDTieredSTOFactory = artifacts.require("./USDTieredSTOFactory.sol");
const SecurityTokenRegistry = artifacts.require("./SecurityTokenRegistry.sol");
const SecurityTokenRegistryProxy = artifacts.require("./SecurityTokenRegistryProxy.sol");
const FeatureRegistry = artifacts.require("./FeatureRegistry.sol");
const STFactory = artifacts.require("./tokens/STFactory.sol");
const DevPolyToken = artifacts.require("./helpers/PolyTokenFaucet.sol");
const MockOracle = artifacts.require("./MockOracle.sol");
const StableOracle = artifacts.require("./StableOracle.sol");
const TokenLib = artifacts.require("./TokenLib.sol");
const SecurityTokenLogic = artifacts.require("./tokens/SecurityToken.sol");
const MockSecurityTokenLogic = artifacts.require("./tokens/MockSecurityTokenLogic.sol");
const STRGetter = artifacts.require('./STRGetter.sol');
const STGetter = artifacts.require('./STGetter.sol');
const MockSTGetter = artifacts.require('./MockSTGetter.sol');
const DataStoreLogic = artifacts.require('./DataStore.sol');
const DataStoreFactory = artifacts.require('./DataStoreFactory.sol');
const VolumeRestrictionTMFactory = artifacts.require('./VolumeRestrictionTMFactory.sol')
const VolumeRestrictionTMLogic = artifacts.require('./VolumeRestrictionTM.sol');
const VolumeRestrictionLib = artifacts.require('./VolumeRestrictionLib.sol');

const Web3 = require("web3");
let BN = Web3.utils.BN;
const nullAddress = "0x0000000000000000000000000000000000000000";
const cappedSTOSetupCost = new BN(20000).mul(new BN(10).pow(new BN(18))); // 20K POLY fee
const usdTieredSTOSetupCost = new BN(100000).mul(new BN(10).pow(new BN(18))); // 100K POLY fee
const initRegFee = new BN(250).mul(new BN(10).pow(new BN(18))); // 250 POLY fee for registering ticker or security token in registry
let PolyToken;
let UsdToken;
let ETHOracle;
let POLYOracle;
let StablePOLYOracle;

module.exports = function(deployer, network, accounts) {
    // Ethereum account address hold by the Polymath (Act as the main account which have ownable permissions)
    let PolymathAccount;
    let moduleRegistry;
    let polymathRegistry;
    let web3;
    if (network === "development") {
        web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
        PolymathAccount = accounts[0];
        deployer.deploy(DevPolyToken)
        .then(() => {
            PolyToken = DevPolyToken.address;
        });
         // Development network polytoken address
        deployer.deploy(DevPolyToken, { from: PolymathAccount }).then(() => {
            DevPolyToken.deployed().then(mockedUSDToken => {
                UsdToken = mockedUSDToken.address;
            });
        });
        deployer
            .deploy(
                MockOracle,
                nullAddress,
                web3.utils.fromAscii("POLY"),
                web3.utils.fromAscii("USD"),
                new BN(5).mul(new BN(10).pow(new BN(17))),
                { from: PolymathAccount }
            ).then(() => {
                return MockOracle.deployed();
            }).then(mockedOracle => {
                POLYOracle = mockedOracle.address;
            }).then(() => {
                return deployer
                    .deploy(
                        StableOracle,
                        POLYOracle,
                        new BN(10).mul(new BN(10).pow(new BN(16))),
                        { from: PolymathAccount }
                    );
            }).then(() => {
                return StableOracle.deployed();
            }).then(stableOracle => {
                    StablePOLYOracle = stableOracle.address;
            });
        deployer
            .deploy(
                MockOracle,
                nullAddress,
                web3.utils.fromAscii("ETH"),
                web3.utils.fromAscii("USD"),
                new BN(500).mul(new BN(10).pow(new BN(18))),
                { from: PolymathAccount }
            )
            .then(() => {
                MockOracle.deployed().then(mockedOracle => {
                    ETHOracle = mockedOracle.address;
                });
            });
        deployer.deploy(PolymathRegistry)
        .then((pr) => {
            polymathRegistry = pr;
        });
    } else if (network === "kovan") {
        web3 = new Web3(new Web3.providers.HttpProvider("https://kovan.infura.io/g5xfoQ0jFSE9S5LwM1Ei"));
        PolymathAccount = accounts[0];
        PolyToken = "0xb347b9f5b56b431b2cf4e1d90a5995f7519ca792"; // PolyToken Kovan Faucet Address
        POLYOracle = "0x461d98EF2A0c7Ac1416EF065840fF5d4C946206C"; // Poly Oracle Kovan Address
        ETHOracle = "0xCE5551FC9d43E9D2CC255139169FC889352405C8"; // ETH Oracle Kovan Address
        StablePOLYOracle = ""; // TODO
        polymathRegistry = "";
    } else if (network === "mainnet") {
        web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/g5xfoQ0jFSE9S5LwM1Ei"));
        PolymathAccount = accounts[0];
        PolyToken = "0x9992eC3cF6A55b00978cdDF2b27BC6882d88D1eC"; // Mainnet PolyToken Address
        POLYOracle = "0x52cb4616E191Ff664B0bff247469ce7b74579D1B"; // Poly Oracle Mainnet Address
        ETHOracle = "0x60055e9a93aae267da5a052e95846fa9469c0e7a"; // ETH Oracle Mainnet Address
        StablePOLYOracle = ""; // TODO
        polymathRegistry = "";
    }

    const tokenInitBytes = {
        name: "initialize",
        type: "function",
        inputs: [
            {
                type: "address",
                name: "_getterDelegate"
            }
        ]
    };

    // POLYMATH NETWORK Configuration :: DO THIS ONLY ONCE
    // A) Deploy the PolymathRegistry contract
    return deployer
        .deploy(TokenLib, { from: PolymathAccount })
        .then(() => {
            return deployer.deploy(VolumeRestrictionLib, { from: PolymathAccount });
        })
        .then(() => {
            // Link libraries
            deployer.link(VolumeRestrictionLib, VolumeRestrictionTMLogic);
            deployer.link(TokenLib, SecurityTokenLogic);
            deployer.link(TokenLib, MockSecurityTokenLogic);
            deployer.link(TokenLib, STFactory);
            deployer.link(TokenLib, STGetter);
            deployer.link(TokenLib, MockSTGetter);
        })
        .then(() => {
            // B) Deploy the GeneralTransferManagerLogic Contract (Factory used to generate the GeneralTransferManager contract and this
            // manager attach with the securityToken contract at the time of deployment)
            return deployer.deploy(GeneralTransferManagerLogic, nullAddress, nullAddress, { from: PolymathAccount });
        })
        .then(() => {
            // B) Deploy the GeneralPermissionManagerLogic Contract (Factory used to generate the GeneralPermissionManager contract and this
            // manager attach with the securityToken contract at the time of deployment)
            return deployer.deploy(GeneralPermissionManagerLogic, nullAddress, nullAddress, { from: PolymathAccount });
        })
        .then(() => {
            // B) Deploy the CountTransferManagerLogic Contract (Factory used to generate the CountTransferManager contract and this
            // manager attach with the securityToken contract at the time of deployment)
            return deployer.deploy(CountTransferManagerLogic, nullAddress, nullAddress, { from: PolymathAccount });
        })
        .then(() => {
            // B) Deploy the ManualApprovalTransferManagerLogic Contract (Factory used to generate the ManualApprovalTransferManager contract and this
            // manager attach with the securityToken contract at the time of deployment)
            return deployer.deploy(ManualApprovalTransferManagerLogic, nullAddress, nullAddress, { from: PolymathAccount });
        })
        .then(() => {
            // B) Deploy the PercentageTransferManagerLogic Contract (Factory used to generate the PercentageTransferManager contract and this
            // manager attach with the securityToken contract at the time of deployment)
            return deployer.deploy(PercentageTransferManagerLogic, nullAddress, nullAddress, { from: PolymathAccount });
        })
        .then(() => {
            // B) Deploy the ERC20DividendCheckpointLogic Contract (Factory used to generate the ERC20DividendCheckpoint contract and this
            // manager attach with the securityToken contract at the time of deployment)
            return deployer.deploy(ERC20DividendCheckpointLogic, nullAddress, nullAddress, { from: PolymathAccount });
        })
        .then(() => {
            // B) Deploy the EtherDividendCheckpointLogic Contract (Factory used to generate the EtherDividendCheckpoint contract and this
            // manager attach with the securityToken contract at the time of deployment)
            return deployer.deploy(EtherDividendCheckpointLogic, nullAddress, nullAddress, { from: PolymathAccount });
        })
        .then(() => {
            // B) Deploy the USDTieredSTOLogic Contract (Factory used to generate the USDTieredSTO contract and this
            // manager attach with the securityToken contract at the time of deployment)
            return deployer.deploy(USDTieredSTOLogic, nullAddress, nullAddress, { from: PolymathAccount });
        })
        .then(() => {
            // B) Deploy the VolumeRestrictionTMLogic Contract (Factory used to generate the VolumeRestrictionTM contract and this
            // manager attach with the securityToken contract at the time of deployment)
            return deployer.deploy(VolumeRestrictionTMLogic, nullAddress, nullAddress, { from: PolymathAccount });
        })
        .then(() => {
            // B) Deploy the CappedSTOLogic Contract (Factory used to generate the CappedSTO contract and this
            // manager attach with the securityToken contract at the time of deployment)
            return deployer.deploy(CappedSTOLogic, nullAddress, nullAddress, { from: PolymathAccount });
        })
        .then(() => {
            // B) Deploy the DataStoreLogic Contract
            return deployer.deploy(DataStoreLogic, { from: PolymathAccount });
        })
        .then(() => {
            // B) Deploy the SecurityTokenLogic Contract
            return deployer.deploy(SecurityTokenLogic, "", "", 0, { from: PolymathAccount });
        })
        .then(() => {
            // B) Deploy the DataStoreFactory Contract
            return deployer.deploy(DataStoreFactory, DataStoreLogic.address, { from: PolymathAccount });
        })
        .then(() => {
            // B) Deploy the GeneralTransferManagerFactory Contract (Factory used to generate the GeneralTransferManager contract and this
            // manager attach with the securityToken contract at the time of deployment)
            return deployer.deploy(GeneralTransferManagerFactory, new BN(0), new BN(0), GeneralTransferManagerLogic.address, polymathRegistry.address, {
                from: PolymathAccount
            });
        })
        .then(() => {
            // C) Deploy the GeneralPermissionManagerFactory Contract (Factory used to generate the GeneralPermissionManager contract and
            // this manager attach with the securityToken contract at the time of deployment)
            return deployer.deploy(GeneralPermissionManagerFactory, new BN(0), new BN(0), GeneralPermissionManagerLogic.address, polymathRegistry.address, {
                from: PolymathAccount
            });
        })
        .then(() => {
            // D) Deploy the CountTransferManagerFactory Contract (Factory used to generate the CountTransferManager contract use
            // to track the counts of the investors of the security token)
            return deployer.deploy(CountTransferManagerFactory, new BN(0), new BN(0), CountTransferManagerLogic.address, polymathRegistry.address, {
                from: PolymathAccount
            });
        })
        .then(() => {
            // D) Deploy the PercentageTransferManagerFactory Contract (Factory used to generate the PercentageTransferManager contract use
            // to track the percentage of investment the investors could do for a particular security token)
            return deployer.deploy(PercentageTransferManagerFactory, new BN(0), new BN(0), PercentageTransferManagerLogic.address, polymathRegistry.address, {
                from: PolymathAccount
            });
        })
        .then(() => {
            // D) Deploy the EtherDividendCheckpointFactory Contract (Factory used to generate the EtherDividendCheckpoint contract use
            // to provide the functionality of the dividend in terms of ETH)
            return deployer.deploy(EtherDividendCheckpointFactory, new BN(0), new BN(0), EtherDividendCheckpointLogic.address, polymathRegistry.address, {
                from: PolymathAccount
            });
        })
        .then(() => {
            // D) Deploy the ERC20DividendCheckpointFactory Contract (Factory used to generate the ERC20DividendCheckpoint contract use
            // to provide the functionality of the dividend in terms of ERC20 token)
            return deployer.deploy(ERC20DividendCheckpointFactory, new BN(0), new BN(0), ERC20DividendCheckpointLogic.address, polymathRegistry.address, {
                from: PolymathAccount
            });
        })
        .then(() => {
            // D) Deploy the VolumeRestrictionTMFactory Contract (Factory used to generate the VolumeRestrictionTM contract use
            // to provide the functionality of restricting the token volume)
            return deployer.deploy(VolumeRestrictionTMFactory, new BN(0), new BN(0), VolumeRestrictionTMLogic.address, polymathRegistry.address, { from: PolymathAccount });
        })
        .then(() => {
            // D) Deploy the ManualApprovalTransferManagerFactory Contract (Factory used to generate the ManualApprovalTransferManager contract use
            // to manual approve the transfer that will overcome the other transfer restrictions)
            return deployer.deploy(ManualApprovalTransferManagerFactory, new BN(0), new BN(0), ManualApprovalTransferManagerLogic.address, polymathRegistry.address, {
                from: PolymathAccount
            });
        })
        .then(() => {
            // H) Deploy the USDTieredSTOFactory (Use to generate the USDTieredSTOFactory contract which will used to collect the funds ).
            return deployer.deploy(USDTieredSTOFactory, usdTieredSTOSetupCost, new BN(0), USDTieredSTOLogic.address, polymathRegistry.address, { from: PolymathAccount });
        })
        .then(() => {
            // H) Deploy the CappedSTOFactory (Use to generate the CappedSTOFactory contract which will used to collect the funds ).
            return deployer.deploy(CappedSTOFactory, cappedSTOSetupCost, new BN(0), CappedSTOLogic.address, polymathRegistry.address, { from: PolymathAccount });
        })
        .then(() => {
            // Deploy the STGetter contract (Logic contract that have the getters of the securityToken)
            return deployer.deploy(STGetter, { from: PolymathAccount });
        })
        .then(() => {
            // H) Deploy the STVersionProxy001 Contract which contains the logic of deployment of securityToken.
            let tokenInitBytesCall = web3.eth.abi.encodeFunctionCall(tokenInitBytes, [STGetter.address]);
            return deployer.deploy(STFactory, polymathRegistry.address, GeneralTransferManagerFactory.address, DataStoreFactory.address, "3.0.0", SecurityTokenLogic.address, tokenInitBytesCall, { from: PolymathAccount });
        })
        .then(() => {
            // K) Deploy the FeatureRegistry contract to control feature switches
            return deployer.deploy(FeatureRegistry, PolymathRegistry.address, { from: PolymathAccount });
        })
        .then(() => {
            // Assign the address into the FeatureRegistry key
            return polymathRegistry.changeAddress("FeatureRegistry", FeatureRegistry.address, { from: PolymathAccount });
        })
        .then(() => {
            // J) Deploy the SecurityTokenRegistry contract (Used to hold the deployed secuirtyToken details. It also act as the interface to deploy the SecurityToken)
            return deployer.deploy(SecurityTokenRegistry, { from: PolymathAccount });
        })
        .then(() => {
            return deployer.deploy(ModuleRegistry, { from: PolymathAccount });
        })
        .then(() => {
            return deployer.deploy(STRGetter, {from: PolymathAccount});
        })
        .then(() => {
            console.log("\n");
            console.log(`

    ----------------------- Polymath Network Smart Contracts: -----------------------
    SecurityTokenRegistry:                ${SecurityTokenRegistry.address}
    ModuleRegistry:                       ${ModuleRegistry.address}
    STRGetter:                            ${STRGetter.address}
    STFactory:                            ${STFactory.address}

    GeneralTransferManagerLogic:          ${GeneralTransferManagerLogic.address}
    GeneralTransferManagerFactory:        ${GeneralTransferManagerFactory.address}
    GeneralPermissionManagerLogic:        ${GeneralPermissionManagerLogic.address}
    GeneralPermissionManagerFactory:      ${GeneralPermissionManagerFactory.address}

    CappedSTOLogic:                       ${CappedSTOLogic.address}
    CappedSTOFactory:                     ${CappedSTOFactory.address}
    USDTieredSTOLogic:                    ${USDTieredSTOLogic.address}
    USDTieredSTOFactory:                  ${USDTieredSTOFactory.address}

    CountTransferManagerLogic:            ${CountTransferManagerLogic.address}
    CountTransferManagerFactory:          ${CountTransferManagerFactory.address}
    PercentageTransferManagerLogic:       ${PercentageTransferManagerLogic.address}
    PercentageTransferManagerFactory:     ${PercentageTransferManagerFactory.address}
    ManualApprovalTransferManagerLogic:   ${ManualApprovalTransferManagerLogic.address}
    ManualApprovalTransferManagerFactory: ${ManualApprovalTransferManagerFactory.address}
    EtherDividendCheckpointLogic:         ${EtherDividendCheckpointLogic.address}
    ERC20DividendCheckpointLogic:         ${ERC20DividendCheckpointLogic.address}
    EtherDividendCheckpointFactory:       ${EtherDividendCheckpointFactory.address}
    ERC20DividendCheckpointFactory:       ${ERC20DividendCheckpointFactory.address}
    VolumeRestrictionTMFactory:           ${VolumeRestrictionTMFactory.address}
    VolumeRestrictionTMLogic:             ${VolumeRestrictionTMLogic.address}
    ---------------------------------------------------------------------------------
    `);
            console.log("\n");
            // -------- END OF POLYMATH NETWORK Configuration -------//
        });
};
