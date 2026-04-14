// =============================================================================
// TrustLedger - Chaincode Entry Point
// Registers all contracts with Hyperledger Fabric runtime
// =============================================================================

'use strict';

const SavingsContract = require('./SavingsContract');
const LoansContract = require('./LoansContract');
const LedgerContract = require('./LedgerContract');

module.exports.contracts = [SavingsContract, LoansContract, LedgerContract];
