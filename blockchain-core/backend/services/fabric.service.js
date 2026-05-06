// =============================================================================
// TrustLedger - Fabric Gateway Service
// Manages the gRPC connection to the Fabric peer and routes all
// chaincode calls (both transactions and queries).
// =============================================================================

'use strict';

const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const grpc = require('@grpc/grpc-js');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../config/logger');

let gateway = null;
let grpcClient = null;
let network = null;
let contract = null;

function readTlsCaBuffer() {
  if (config.fabric.materialMode === 'pem') {
    return Buffer.from(config.fabric.tlsCertPem, 'utf8');
  }
  return fs.readFileSync(path.resolve(config.fabric.tlsCertPath));
}

function readCertPemString() {
  if (config.fabric.materialMode === 'pem') {
    return config.fabric.certPem;
  }
  return fs.readFileSync(path.resolve(config.fabric.certPath), 'utf8');
}

function readPrivateKeyPem() {
  if (config.fabric.materialMode === 'pem') {
    return config.fabric.keyPem;
  }
  const keyDir = path.resolve(config.fabric.keyDir);
  const keyFiles = fs.readdirSync(keyDir).filter((f) => !f.startsWith('.'));
  if (keyFiles.length === 0) throw new Error('No private key found in keystore directory.');
  return fs.readFileSync(path.join(keyDir, keyFiles[0]), 'utf8');
}

// ─── Build gRPC Client ────────────────────────────────────────────────────────
function buildGrpcClient() {
  const tlsCert = readTlsCaBuffer();
  const credentials = grpc.credentials.createSsl(tlsCert);
  return new grpc.Client(config.fabric.peerEndpoint, credentials, {
    'grpc.ssl_target_name_override': config.fabric.peerHostAlias,
  });
}

// ─── Build Fabric Identity & Signer ──────────────────────────────────────────
function buildIdentity() {
  const certPem = readCertPemString();
  return {
    mspId:       config.fabric.mspId,
    credentials: Buffer.from(certPem),
  };
}

function buildSigner() {
  const certPem = readCertPemString();
  const keyPem = readPrivateKeyPem();
  const privateKey = crypto.createPrivateKey(keyPem);
  try {
    new crypto.X509Certificate(certPem).checkPrivateKey(privateKey);
  } catch {
    throw new Error(
      'FABRIC certificate does not match the private key. ' +
        'If using PEM env vars, check FABRIC_CERT_PEM and FABRIC_KEY_PEM; ' +
        'if using files, ensure FABRIC_CERT_PATH and FABRIC_KEY_DIR keystore belong together.'
    );
  }
  // Gateway passes SHA256(proposalBytes) as digest; sign that with ECDSA (low-S DER), do not hash again.
  return signers.newPrivateKeySigner(privateKey);
}

function fabricDisabledError() {
  const err = new Error(
    'Hyperledger Fabric is disabled (FABRIC_ENABLED=false). Enable Fabric and configure credentials to use blockchain routes.'
  );
  err.statusCode = 503;
  return err;
}

// ─── Connect ──────────────────────────────────────────────────────────────────
async function connect_() {
  if (!config.fabric.enabled) {
    logger.warn('Hyperledger Fabric is disabled (FABRIC_ENABLED=false). Blockchain reads/writes are unavailable.');
    return;
  }

  if (gateway) return; // Already connected

  logger.info('Connecting to Hyperledger Fabric network...');

  grpcClient = buildGrpcClient();

  gateway = connect({
    client:    grpcClient,
    identity:  buildIdentity(),
    signer:    buildSigner(),
    hash:      hash.sha256,
    evaluateOptions:  () => ({ deadline: Date.now() + 5_000  }),
    endorseOptions:   () => ({ deadline: Date.now() + 15_000 }),
    submitOptions:    () => ({ deadline: Date.now() + 5_000  }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60_000 }),
  });

  network  = gateway.getNetwork(config.fabric.channelName);
  contract = network.getContract(config.fabric.chaincodeName);

  logger.info(`Connected to channel: ${config.fabric.channelName}`);
}

// ─── Disconnect ───────────────────────────────────────────────────────────────
function disconnect() {
  if (!config.fabric.enabled) return;

  if (gateway) {
    gateway.close();
    grpcClient.close();
    gateway    = null;
    grpcClient = null;
    network    = null;
    contract   = null;
    logger.info('Disconnected from Fabric network.');
  }
}

/**
 * Parse chaincode return payload. Some paths return double-encoded JSON (a JSON string
 * whose value is another JSON document). A single JSON.parse then yields a string, which
 * breaks API clients that expect `data` to be an object.
 */
function parseFabricResult(result) {
  if (!result || result.length === 0) return null;
  // Fabric Gateway returns bytes (Buffer/Uint8Array). Always normalize via Buffer
  // so we decode UTF-8 JSON text correctly across Node runtimes.
  const raw = Buffer.from(result).toString('utf8').replace(/^\uFEFF/, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (typeof parsed === 'string') {
    const inner = parsed.trim();
    if (
      (inner.startsWith('{') && inner.endsWith('}')) ||
      (inner.startsWith('[') && inner.endsWith(']'))
    ) {
      try {
        return JSON.parse(inner);
      } catch {
        return parsed;
      }
    }
  }
  return parsed;
}

// ─── Submit Transaction (write to ledger) ─────────────────────────────────────
/**
 * Submits a transaction that modifies ledger state.
 * Goes through endorsement → ordering → commit.
 */
async function submitTransaction(contractNamespace, fnName, ...args) {
  if (!config.fabric.enabled) throw fabricDisabledError();

  await connect_();

  const nsContract = network.getContract(
    config.fabric.chaincodeName,
    contractNamespace
  );

  logger.debug(`TX submit: ${contractNamespace}:${fnName}`, { args });

  const result = await nsContract.submitTransaction(fnName, ...args.map(String));

  if (!result || result.length === 0) return null;

  return parseFabricResult(result);
}

// ─── Evaluate Transaction (read from ledger) ──────────────────────────────────
/**
 * Evaluates a query — does not go to the orderer, reads from peer directly.
 * Faster and free (no ordering fee).
 */
async function evaluateTransaction(contractNamespace, fnName, ...args) {
  if (!config.fabric.enabled) throw fabricDisabledError();

  await connect_();

  const nsContract = network.getContract(
    config.fabric.chaincodeName,
    contractNamespace
  );

  logger.debug(`TX evaluate: ${contractNamespace}:${fnName}`, { args });

  const result = await nsContract.evaluateTransaction(fnName, ...args.map(String));

  if (!result || result.length === 0) return null;

  return parseFabricResult(result);
}

// ─── Contract Namespaces ──────────────────────────────────────────────────────
// Convenience wrappers for each contract namespace
const SavingsContract = {
  submit:   (fn, ...args) => submitTransaction('SavingsContract', fn, ...args),
  evaluate: (fn, ...args) => evaluateTransaction('SavingsContract', fn, ...args),
};

const LoansContract = {
  submit:   (fn, ...args) => submitTransaction('LoansContract', fn, ...args),
  evaluate: (fn, ...args) => evaluateTransaction('LoansContract', fn, ...args),
};

const LedgerContract = {
  submit:   (fn, ...args) => submitTransaction('LedgerContract', fn, ...args),
  evaluate: (fn, ...args) => evaluateTransaction('LedgerContract', fn, ...args),
};

function isConnected() {
  return !!gateway;
}

module.exports = {
  connect: connect_,
  disconnect,
  isConnected,
  submitTransaction,
  evaluateTransaction,
  SavingsContract,
  LoansContract,
  LedgerContract,
};
