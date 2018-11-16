import {deployPolyRegistryAndPolyToken, deployVestingEscrowWallet} from "./helpers/createInstances";
import latestTime from "./helpers/latestTime";
import {duration as durationUtil} from "./helpers/utils";
import {catchRevert} from "./helpers/exceptions";
import {increaseTime} from "./helpers/time";

const VestingEscrowWallet = artifacts.require('./VestingEscrowWallet.sol');

const Web3 = require('web3');
const BigNumber = require('bignumber.js');
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));// Hardcoded development port

//TODO check withdraw with 3 schedules and few passed steps for beneficiary
//TODO tests for batch operations
//TODO negative cases
contract('VestingEscrowWallet', accounts => {

    const CREATED = 0;
    const STARTED = 1;
    const COMPLETED = 2;

    // Accounts Variable declaration
    let account_polymath;
    let wallet_owner;
    let account_treasury;
    let account_beneficiary1;
    let account_beneficiary2;
    let account_beneficiary3;

    let message = "Transaction Should Fail!";

    // Contract Instance Declaration
    let I_VestingEscrowWallet;
    let I_PolyToken;
    let I_PolymathRegistry;

    before(async () => {
        // Accounts setup
        account_polymath = accounts[0];
        wallet_owner = accounts[1];
        account_treasury = accounts[2];

        account_beneficiary1 = accounts[7];
        account_beneficiary2 = accounts[8];
        account_beneficiary3 = accounts[9];

        // Step 1: Deploy the PolyToken
        [I_PolymathRegistry, I_PolyToken] = await deployPolyRegistryAndPolyToken(account_polymath, account_treasury);

        // STEP 2: Deploy the VestingEscrowWallet
        [I_VestingEscrowWallet] = await deployVestingEscrowWallet(wallet_owner, I_PolyToken.address, account_treasury);

        // Printing all the contract addresses
        console.log(`
        --------------------- Polymath Network Smart Contracts: ---------------------
        PolymathRegistry:                  ${I_PolymathRegistry.address}
        PolyToken:                         ${I_PolyToken.address}

        VestingEscrowWalle:                ${I_VestingEscrowWallet.address}
        -----------------------------------------------------------------------------
        `);
    });

    describe("Depositing and withdrawing tokens", async () => {

        it("Should deposit tokens for new Vesting Schedules", async () => {
            let numberOfTokens = 25000;
            await I_PolyToken.approve(I_VestingEscrowWallet.address, numberOfTokens, { from: account_treasury });
            const tx = await I_VestingEscrowWallet.depositTokens(numberOfTokens, {from: wallet_owner});

            assert.equal(tx.logs[0].args._numberOfTokens, numberOfTokens);

            let unassignedTokens = await I_VestingEscrowWallet.unassignedTokens.call();
            assert.equal(unassignedTokens, numberOfTokens);

            let balance = await I_PolyToken.balanceOf.call(I_VestingEscrowWallet.address);
            assert.equal(balance.toNumber(), numberOfTokens);
        });

        it("Should withdraw tokens to a treasury", async () => {
            let numberOfTokens = 25000;
            const tx = await I_VestingEscrowWallet.sendToTreasury({from: wallet_owner});

            assert.equal(tx.logs[0].args._numberOfTokens, numberOfTokens);

            let unassignedTokens = await I_VestingEscrowWallet.unassignedTokens.call();
            assert.equal(unassignedTokens, 0);

            let balance = await I_PolyToken.balanceOf.call(I_VestingEscrowWallet.address);
            assert.equal(balance.toNumber(), 0);
        });

        it("Should send available tokens to the beneficiary address", async () => {
            let numberOfTokens = 75000;
            let duration = durationUtil.seconds(30);
            let frequency = durationUtil.seconds(10);
            let timeShift = durationUtil.seconds(100);
            let startTime = latestTime() + timeShift;
            await I_PolyToken.approve(I_VestingEscrowWallet.address, numberOfTokens, { from: account_treasury });
            await I_VestingEscrowWallet.depositTokens(numberOfTokens, {from: wallet_owner});
            await I_VestingEscrowWallet.addSchedule(account_beneficiary3, numberOfTokens, duration, frequency, startTime, {from: wallet_owner});
            await increaseTime(timeShift + frequency);
            await I_VestingEscrowWallet.update(account_beneficiary3, {from: wallet_owner});

            const tx = await I_VestingEscrowWallet.sendAvailableTokens(account_beneficiary3, {from: wallet_owner});
            assert.equal(tx.logs[0].args._beneficiary, account_beneficiary3);
            assert.equal(tx.logs[0].args._numberOfTokens.toNumber(), numberOfTokens / 3);

            let balance = await I_PolyToken.balanceOf.call(account_beneficiary3);
            assert.equal(balance.toNumber(), numberOfTokens / 3);

            await I_PolyToken.transfer(account_treasury, balance, {from: account_beneficiary3});
            await I_VestingEscrowWallet.revokeSchedules(account_beneficiary3, {from: wallet_owner});
            await I_VestingEscrowWallet.sendToTreasury({from: wallet_owner});
        });

        it("Should withdraw available tokens to the beneficiary address", async () => {
            let numberOfTokens = 33000;
            let duration = durationUtil.seconds(30);
            let frequency = durationUtil.seconds(10);
            let timeShift = durationUtil.seconds(100);
            let startTime = latestTime() + timeShift;
            await I_PolyToken.approve(I_VestingEscrowWallet.address, numberOfTokens, { from: account_treasury });
            await I_VestingEscrowWallet.depositTokens(numberOfTokens, {from: wallet_owner});
            await I_VestingEscrowWallet.addSchedule(account_beneficiary3, numberOfTokens, duration, frequency, startTime, {from: wallet_owner});
            await increaseTime(timeShift + frequency * 3);
            await I_VestingEscrowWallet.update(account_beneficiary3, {from: wallet_owner});
            await I_VestingEscrowWallet.update(account_beneficiary3, {from: wallet_owner});
            await I_VestingEscrowWallet.update(account_beneficiary3, {from: wallet_owner});
            await I_VestingEscrowWallet.update(account_beneficiary3, {from: wallet_owner});

            const tx = await I_VestingEscrowWallet.withdrawAvailableTokens({from: account_beneficiary3});
            assert.equal(tx.logs[0].args._beneficiary, account_beneficiary3);
            assert.equal(tx.logs[0].args._numberOfTokens.toNumber(), numberOfTokens);

            let balance = await I_PolyToken.balanceOf.call(account_beneficiary3);
            assert.equal(balance.toNumber(), numberOfTokens);

            await I_PolyToken.transfer(account_treasury, balance, {from: account_beneficiary3});
            await I_VestingEscrowWallet.revokeSchedules(account_beneficiary3, {from: wallet_owner});
            await I_VestingEscrowWallet.sendToTreasury({from: wallet_owner});
        });

    });

    describe("Adding, Editing and Revoking Vesting Schedule", async () => {

        let schedules = [
            {
                numberOfTokens: 100000,
                duration: durationUtil.years(4),
                frequency: durationUtil.years(1),
                startTime: latestTime() + durationUtil.days(1)
            },
            {
                numberOfTokens: 30000,
                duration: durationUtil.weeks(6),
                frequency: durationUtil.weeks(1),
                startTime: latestTime() + durationUtil.days(2)
            },
            {
                numberOfTokens: 2000,
                duration: durationUtil.days(10),
                frequency: durationUtil.days(2),
                startTime: latestTime() + durationUtil.days(3)
            }
        ];

        it("Should add Vesting Schedule to the beneficiary address", async () => {
            let numberOfTokens = schedules[0].numberOfTokens;
            let duration = schedules[0].duration;
            let frequency = schedules[0].frequency;
            let startTime = schedules[0].startTime;
            await I_PolyToken.approve(I_VestingEscrowWallet.address, numberOfTokens, { from: account_treasury });
            await I_VestingEscrowWallet.depositTokens(numberOfTokens, {from: wallet_owner});
            const tx = await I_VestingEscrowWallet.addSchedule(account_beneficiary1, numberOfTokens, duration, frequency, startTime, {from: wallet_owner});

            let log = tx.logs[0];
            checkScheduleLog(log, account_beneficiary1, numberOfTokens, duration, frequency, startTime);

            let scheduleCount = await I_VestingEscrowWallet.getScheduleCount.call(account_beneficiary1);
            assert.equal(scheduleCount, 1);

            let schedule = await I_VestingEscrowWallet.getSchedule.call(account_beneficiary1, 0);
            checkSchedule(schedule, numberOfTokens, numberOfTokens, duration, frequency, startTime, startTime + frequency, CREATED);
        });

        it("Should edit Vesting Schedule to the beneficiary address", async () => {
            let numberOfTokens = schedules[1].numberOfTokens;
            let duration = schedules[1].duration;
            let frequency = schedules[1].frequency;
            let startTime = schedules[1].startTime;
            const tx = await I_VestingEscrowWallet.editSchedule(account_beneficiary1, 0, numberOfTokens, duration, frequency, startTime, {from: wallet_owner});

            let log = tx.logs[0];
            checkScheduleLog(log, account_beneficiary1, numberOfTokens, duration, frequency, startTime);

            let scheduleCount = await I_VestingEscrowWallet.getScheduleCount.call(account_beneficiary1);
            assert.equal(scheduleCount, 1);

            let schedule = await I_VestingEscrowWallet.getSchedule.call(account_beneficiary1, 0);
            checkSchedule(schedule, numberOfTokens, numberOfTokens, duration, frequency, startTime, startTime + frequency, CREATED);

            let unassignedTokens = await I_VestingEscrowWallet.unassignedTokens.call();
            assert.equal(unassignedTokens.toNumber(), schedules[0].numberOfTokens - schedules[1].numberOfTokens);
        });

        it("Should fail edit Vesting Schedule to the beneficiary address", async () => {
            let numberOfTokens = schedules[0].numberOfTokens + schedules[1].numberOfTokens;
            let duration = schedules[0].duration;
            let frequency = schedules[0].frequency;
            let startTime = schedules[0].startTime;
            await catchRevert(
                I_VestingEscrowWallet.editSchedule(account_beneficiary1, 0, numberOfTokens, duration, frequency, startTime, {from: wallet_owner})
            );
        });

        it("Should revoke Vesting Schedule from the beneficiary address", async () => {
            const tx = await I_VestingEscrowWallet.revokeSchedule(account_beneficiary1, 0, {from: wallet_owner});

            assert.equal(tx.logs[0].args._beneficiary, account_beneficiary1);
            assert.equal(tx.logs[0].args._index, 0);

            let scheduleCount = await I_VestingEscrowWallet.getScheduleCount.call(account_beneficiary1);
            assert.equal(scheduleCount, 0);
        });

        it("Should add 3 Vesting Schedules to the beneficiary address", async () => {
            let totalNumberOfTokens = getTotalNumberOfTokens(schedules);
            await I_PolyToken.approve(I_VestingEscrowWallet.address, totalNumberOfTokens, {from: account_treasury});
            await I_VestingEscrowWallet.depositTokens(totalNumberOfTokens, {from: wallet_owner});
            for (let i = 0; i < schedules.length; i++) {
                let numberOfTokens = schedules[i].numberOfTokens;
                let duration = schedules[i].duration;
                let frequency = schedules[i].frequency;
                let startTime = schedules[i].startTime;
                const tx = await I_VestingEscrowWallet.addSchedule(account_beneficiary2, numberOfTokens, duration, frequency, startTime, {from: wallet_owner});

                let log = tx.logs[0];
                checkScheduleLog(log, account_beneficiary2, numberOfTokens, duration, frequency, startTime);

                let scheduleCount = await I_VestingEscrowWallet.getScheduleCount.call(account_beneficiary2);
                assert.equal(scheduleCount, i + 1);

                let schedule = await I_VestingEscrowWallet.getSchedule.call(account_beneficiary2, i);
                checkSchedule(schedule, numberOfTokens, numberOfTokens, duration, frequency, startTime, startTime + frequency, CREATED);
            }
        });

        it("Should revoke Vesting Schedule from the beneficiary address", async () => {
            const tx = await I_VestingEscrowWallet.revokeSchedule(account_beneficiary2, 1, {from: wallet_owner});

            assert.equal(tx.logs[0].args._beneficiary, account_beneficiary2);
            assert.equal(tx.logs[0].args._index, 1);

            let scheduleCount = await I_VestingEscrowWallet.getScheduleCount.call(account_beneficiary2);
            assert.equal(scheduleCount, 2);

            let schedule = await I_VestingEscrowWallet.getSchedule.call(account_beneficiary2, 1);
            checkSchedule(schedule, schedules[2].numberOfTokens, schedules[2].numberOfTokens, schedules[2].duration, schedules[2].frequency,
                          schedules[2].startTime, schedules[2].startTime + schedules[2].frequency, CREATED);
        });

        it("Should revoke 2 Vesting Schedules from the beneficiary address", async () => {
            const tx = await I_VestingEscrowWallet.revokeSchedules(account_beneficiary2, {from: wallet_owner});

            assert.equal(tx.logs[0].args._beneficiary, account_beneficiary2);

            let scheduleCount = await I_VestingEscrowWallet.getScheduleCount.call(account_beneficiary2);
            assert.equal(scheduleCount, 0);
        });

        it("Should add 3 Templates", async () => {
            for (let i = 0; i < schedules.length; i++) {
                let numberOfTokens = schedules[i].numberOfTokens;
                let duration = schedules[i].duration;
                let frequency = schedules[i].frequency;
                const tx = await I_VestingEscrowWallet.addTemplate(numberOfTokens, duration, frequency, {from: wallet_owner});

                assert.equal(tx.logs[0].args._numberOfTokens.toNumber(), numberOfTokens);
                assert.equal(tx.logs[0].args._duration.toNumber(), duration);
                assert.equal(tx.logs[0].args._frequency.toNumber(), frequency);
            }
        });

        it("Should remove template", async () => {
            const tx = await I_VestingEscrowWallet.removeTemplate(1, {from: wallet_owner});

            assert.equal(tx.logs[0].args._index, 1);
        });

        it("Should add Vesting Schedule from Template", async () => {
            let numberOfTokens = schedules[2].numberOfTokens;
            let duration = schedules[2].duration;
            let frequency = schedules[2].frequency;
            let startTime = schedules[2].startTime;
            await I_PolyToken.approve(I_VestingEscrowWallet.address, numberOfTokens, { from: account_treasury });
            await I_VestingEscrowWallet.depositTokens(numberOfTokens, {from: wallet_owner});
            const tx = await I_VestingEscrowWallet.addScheduleFromTemplate(account_beneficiary1, 1, startTime, {from: wallet_owner});

            let log = tx.logs[0];
            checkScheduleLog(log, account_beneficiary1, numberOfTokens, duration, frequency, startTime);

            let scheduleCount = await I_VestingEscrowWallet.getScheduleCount.call(account_beneficiary1);
            assert.equal(scheduleCount, 1);

            let schedule = await I_VestingEscrowWallet.getSchedule.call(account_beneficiary1, 0);
            checkSchedule(schedule, numberOfTokens, numberOfTokens, duration, frequency, startTime, startTime + frequency, CREATED);

            await I_VestingEscrowWallet.revokeSchedule(account_beneficiary1, 0, {from: wallet_owner});
        });

        it("Should remove 2 Templates", async () => {
            await I_VestingEscrowWallet.removeTemplate(0, {from: wallet_owner});
            await I_VestingEscrowWallet.removeTemplate(0, {from: wallet_owner});

            let templateCount = await I_VestingEscrowWallet.getTemplateCount.call({from: wallet_owner});
            assert.equal(templateCount, 0);
        });

    });

});

function checkScheduleLog(log, beneficiary, numberOfTokens, duration, frequency, startTime) {
    assert.equal(log.args._beneficiary, beneficiary);
    assert.equal(log.args._numberOfTokens.toNumber(), numberOfTokens);
    assert.equal(log.args._duration.toNumber(), duration);
    assert.equal(log.args._frequency.toNumber(), frequency);
    assert.equal(log.args._startTime.toNumber(), startTime);
}

function checkSchedule(schedule, numberOfTokens, lockedTokens, duration, frequency, startTime, nextTime, state) {
    assert.equal(schedule[0].toNumber(), numberOfTokens);
    assert.equal(schedule[1].toNumber(), lockedTokens);
    assert.equal(schedule[2].toNumber(), duration);
    assert.equal(schedule[3].toNumber(), frequency);
    assert.equal(schedule[4].toNumber(), startTime);
    assert.equal(schedule[5].toNumber(), nextTime);
    assert.equal(schedule[6], state);
}

function getTotalNumberOfTokens(schedules) {
    let numberOfTokens = 0;
    for (let i = 0; i < schedules.length; i++) {
        numberOfTokens += schedules[i].numberOfTokens;
    }
    return numberOfTokens;
}
