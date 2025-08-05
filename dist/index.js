/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 17492:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.attest = void 0;
const bundle_1 = __nccwpck_require__(61040);
const crypto_1 = __nccwpck_require__(76982);
const endpoints_1 = __nccwpck_require__(60223);
const intoto_1 = __nccwpck_require__(61970);
const sign_1 = __nccwpck_require__(39400);
const store_1 = __nccwpck_require__(78740);
const INTOTO_PAYLOAD_TYPE = 'application/vnd.in-toto+json';
/**
 * Generates an attestation for the given subject and predicate. The subject and
 * predicate are combined into an in-toto statement, which is then signed using
 * the identified Sigstore instance and stored as an attestation.
 * @param options - The options for attestation.
 * @returns A promise that resolves to the attestation.
 */
function attest(options) {
    return __awaiter(this, void 0, void 0, function* () {
        let subjects;
        if (options.subjects) {
            subjects = options.subjects;
        }
        else if (options.subjectName && options.subjectDigest) {
            subjects = [{ name: options.subjectName, digest: options.subjectDigest }];
        }
        else {
            throw new Error('Must provide either subjectName and subjectDigest or subjects');
        }
        const predicate = {
            type: options.predicateType,
            params: options.predicate
        };
        const statement = (0, intoto_1.buildIntotoStatement)(subjects, predicate);
        // Sign the provenance statement
        const payload = {
            body: Buffer.from(JSON.stringify(statement)),
            type: INTOTO_PAYLOAD_TYPE
        };
        const endpoints = (0, endpoints_1.signingEndpoints)(options.sigstore);
        const bundle = yield (0, sign_1.signPayload)(payload, endpoints);
        // Store the attestation
        let attestationID;
        if (options.skipWrite !== true) {
            attestationID = yield (0, store_1.writeAttestation)((0, bundle_1.bundleToJSON)(bundle), options.token, { headers: options.headers });
        }
        return toAttestation(bundle, attestationID);
    });
}
exports.attest = attest;
function toAttestation(bundle, attestationID) {
    let certBytes;
    switch (bundle.verificationMaterial.content.$case) {
        case 'x509CertificateChain':
            certBytes =
                bundle.verificationMaterial.content.x509CertificateChain.certificates[0]
                    .rawBytes;
            break;
        case 'certificate':
            certBytes = bundle.verificationMaterial.content.certificate.rawBytes;
            break;
        default:
            throw new Error('Bundle must contain an x509 certificate');
    }
    const signingCert = new crypto_1.X509Certificate(certBytes);
    // Collect transparency log ID if available
    const tlogEntries = bundle.verificationMaterial.tlogEntries;
    const tlogID = tlogEntries.length > 0 ? tlogEntries[0].logIndex : undefined;
    return {
        bundle: (0, bundle_1.bundleToJSON)(bundle),
        certificate: signingCert.toString(),
        tlogID,
        attestationID
    };
}
//# sourceMappingURL=attest.js.map

/***/ }),

/***/ 60223:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.signingEndpoints = exports.SIGSTORE_PUBLIC_GOOD = void 0;
const github = __importStar(__nccwpck_require__(93228));
const PUBLIC_GOOD_ID = 'public-good';
const GITHUB_ID = 'github';
const FULCIO_PUBLIC_GOOD_URL = 'https://fulcio.sigstore.dev';
const REKOR_PUBLIC_GOOD_URL = 'https://rekor.sigstore.dev';
exports.SIGSTORE_PUBLIC_GOOD = {
    fulcioURL: FULCIO_PUBLIC_GOOD_URL,
    rekorURL: REKOR_PUBLIC_GOOD_URL
};
const signingEndpoints = (sigstore) => {
    var _a;
    let instance;
    // An explicitly set instance type takes precedence, but if not set, use the
    // repository's visibility to determine the instance type.
    if (sigstore && [PUBLIC_GOOD_ID, GITHUB_ID].includes(sigstore)) {
        instance = sigstore;
    }
    else {
        instance =
            ((_a = github.context.payload.repository) === null || _a === void 0 ? void 0 : _a.visibility) === 'public'
                ? PUBLIC_GOOD_ID
                : GITHUB_ID;
    }
    switch (instance) {
        case PUBLIC_GOOD_ID:
            return exports.SIGSTORE_PUBLIC_GOOD;
        case GITHUB_ID:
            return buildGitHubEndpoints();
    }
};
exports.signingEndpoints = signingEndpoints;
function buildGitHubEndpoints() {
    const serverURL = process.env.GITHUB_SERVER_URL || 'https://github.com';
    let host = new URL(serverURL).hostname;
    if (host === 'github.com') {
        host = 'githubapp.com';
    }
    return {
        fulcioURL: `https://fulcio.${host}`,
        tsaServerURL: `https://timestamp.${host}`
    };
}
//# sourceMappingURL=endpoints.js.map

/***/ }),

/***/ 11485:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.buildSLSAProvenancePredicate = exports.attestProvenance = exports.attest = void 0;
var attest_1 = __nccwpck_require__(17492);
Object.defineProperty(exports, "attest", ({ enumerable: true, get: function () { return attest_1.attest; } }));
var provenance_1 = __nccwpck_require__(13042);
Object.defineProperty(exports, "attestProvenance", ({ enumerable: true, get: function () { return provenance_1.attestProvenance; } }));
Object.defineProperty(exports, "buildSLSAProvenancePredicate", ({ enumerable: true, get: function () { return provenance_1.buildSLSAProvenancePredicate; } }));
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 61970:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.buildIntotoStatement = void 0;
const INTOTO_STATEMENT_V1_TYPE = 'https://in-toto.io/Statement/v1';
/**
 * Assembles the given subject and predicate into an in-toto statement.
 * @param subject - The subject of the statement.
 * @param predicate - The predicate of the statement.
 * @returns The constructed in-toto statement.
 */
const buildIntotoStatement = (subjects, predicate) => {
    return {
        _type: INTOTO_STATEMENT_V1_TYPE,
        subject: subjects,
        predicateType: predicate.type,
        predicate: predicate.params
    };
};
exports.buildIntotoStatement = buildIntotoStatement;
//# sourceMappingURL=intoto.js.map

/***/ }),

/***/ 85292:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getIDTokenClaims = void 0;
const core_1 = __nccwpck_require__(37484);
const http_client_1 = __nccwpck_require__(54844);
const jose = __importStar(__nccwpck_require__(21608));
const OIDC_AUDIENCE = 'nobody';
const VALID_SERVER_URLS = [
    'https://github.com',
    new RegExp('^https://[a-z0-9-]+\\.ghe\\.com$')
];
const REQUIRED_CLAIMS = [
    'iss',
    'ref',
    'sha',
    'repository',
    'event_name',
    'job_workflow_ref',
    'workflow_ref',
    'repository_id',
    'repository_owner_id',
    'runner_environment',
    'run_id',
    'run_attempt'
];
const getIDTokenClaims = (issuer) => __awaiter(void 0, void 0, void 0, function* () {
    issuer = issuer || getIssuer();
    try {
        const token = yield (0, core_1.getIDToken)(OIDC_AUDIENCE);
        const claims = yield decodeOIDCToken(token, issuer);
        assertClaimSet(claims);
        return claims;
    }
    catch (error) {
        throw new Error(`Failed to get ID token: ${error.message}`);
    }
});
exports.getIDTokenClaims = getIDTokenClaims;
const decodeOIDCToken = (token, issuer) => __awaiter(void 0, void 0, void 0, function* () {
    // Verify and decode token
    const jwks = jose.createLocalJWKSet(yield getJWKS(issuer));
    const { payload } = yield jose.jwtVerify(token, jwks, {
        audience: OIDC_AUDIENCE
    });
    if (!payload.iss) {
        throw new Error('Missing "iss" claim');
    }
    // Check that the issuer STARTS WITH the expected issuer URL to account for
    // the fact that the value may include an enterprise-specific slug
    if (!payload.iss.startsWith(issuer)) {
        throw new Error(`Unexpected "iss" claim: ${payload.iss}`);
    }
    return payload;
});
const getJWKS = (issuer) => __awaiter(void 0, void 0, void 0, function* () {
    const client = new http_client_1.HttpClient('@actions/attest');
    const config = yield client.getJson(`${issuer}/.well-known/openid-configuration`);
    if (!config.result) {
        throw new Error('No OpenID configuration found');
    }
    const jwks = yield client.getJson(config.result.jwks_uri);
    if (!jwks.result) {
        throw new Error('No JWKS found for issuer');
    }
    return jwks.result;
});
function assertClaimSet(claims) {
    const missingClaims = [];
    for (const claim of REQUIRED_CLAIMS) {
        if (!(claim in claims)) {
            missingClaims.push(claim);
        }
    }
    if (missingClaims.length > 0) {
        throw new Error(`Missing claims: ${missingClaims.join(', ')}`);
    }
}
// Derive the current OIDC issuer based on the server URL
function getIssuer() {
    const serverURL = process.env.GITHUB_SERVER_URL || 'https://github.com';
    // Ensure the server URL is a valid GitHub server URL
    if (!VALID_SERVER_URLS.some(valid_url => serverURL.match(valid_url))) {
        throw new Error(`Invalid server URL: ${serverURL}`);
    }
    let host = new URL(serverURL).hostname;
    if (host === 'github.com') {
        host = 'githubusercontent.com';
    }
    return `https://token.actions.${host}`;
}
//# sourceMappingURL=oidc.js.map

/***/ }),

/***/ 13042:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.attestProvenance = exports.buildSLSAProvenancePredicate = void 0;
const attest_1 = __nccwpck_require__(17492);
const oidc_1 = __nccwpck_require__(85292);
const SLSA_PREDICATE_V1_TYPE = 'https://slsa.dev/provenance/v1';
const GITHUB_BUILD_TYPE = 'https://actions.github.io/buildtypes/workflow/v1';
/**
 * Builds an SLSA (Supply Chain Levels for Software Artifacts) provenance
 * predicate using the GitHub Actions Workflow build type.
 * https://slsa.dev/spec/v1.0/provenance
 * https://github.com/slsa-framework/github-actions-buildtypes/tree/main/workflow/v1
 * @param issuer - URL for the OIDC issuer. Defaults to the GitHub Actions token
 * issuer.
 * @returns The SLSA provenance predicate.
 */
const buildSLSAProvenancePredicate = (issuer) => __awaiter(void 0, void 0, void 0, function* () {
    const serverURL = process.env.GITHUB_SERVER_URL;
    const claims = yield (0, oidc_1.getIDTokenClaims)(issuer);
    // Split just the path and ref from the workflow string.
    // owner/repo/.github/workflows/main.yml@main =>
    //   .github/workflows/main.yml, main
    const [workflowPath] = claims.workflow_ref
        .replace(`${claims.repository}/`, '')
        .split('@');
    return {
        type: SLSA_PREDICATE_V1_TYPE,
        params: {
            buildDefinition: {
                buildType: GITHUB_BUILD_TYPE,
                externalParameters: {
                    workflow: {
                        ref: claims.ref,
                        repository: `${serverURL}/${claims.repository}`,
                        path: workflowPath
                    }
                },
                internalParameters: {
                    github: {
                        event_name: claims.event_name,
                        repository_id: claims.repository_id,
                        repository_owner_id: claims.repository_owner_id,
                        runner_environment: claims.runner_environment
                    }
                },
                resolvedDependencies: [
                    {
                        uri: `git+${serverURL}/${claims.repository}@${claims.ref}`,
                        digest: {
                            gitCommit: claims.sha
                        }
                    }
                ]
            },
            runDetails: {
                builder: {
                    id: `${serverURL}/${claims.job_workflow_ref}`
                },
                metadata: {
                    invocationId: `${serverURL}/${claims.repository}/actions/runs/${claims.run_id}/attempts/${claims.run_attempt}`
                }
            }
        }
    };
});
exports.buildSLSAProvenancePredicate = buildSLSAProvenancePredicate;
/**
 * Attests the build provenance of the provided subject. Generates the SLSA
 * build provenance predicate, assembles it into an in-toto statement, and
 * attests it.
 *
 * @param options - The options for attesting the provenance.
 * @returns A promise that resolves to the attestation.
 */
function attestProvenance(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const predicate = yield (0, exports.buildSLSAProvenancePredicate)(options.issuer);
        return (0, attest_1.attest)(Object.assign(Object.assign({}, options), { predicateType: predicate.type, predicate: predicate.params }));
    });
}
exports.attestProvenance = attestProvenance;
//# sourceMappingURL=provenance.js.map

/***/ }),

/***/ 39400:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.signPayload = void 0;
const sign_1 = __nccwpck_require__(15179);
const OIDC_AUDIENCE = 'sigstore';
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_RETRIES = 3;
/**
 * Signs the provided payload with a Sigstore-issued certificate and returns the
 * signature bundle.
 * @param payload Payload to be signed.
 * @param options Signing options.
 * @returns A promise that resolves to the Sigstore signature bundle.
 */
const signPayload = (payload, options) => __awaiter(void 0, void 0, void 0, function* () {
    const artifact = {
        data: payload.body,
        type: payload.type
    };
    // Sign the artifact and build the bundle
    return initBundleBuilder(options).create(artifact);
});
exports.signPayload = signPayload;
// Assembles the Sigstore bundle builder with the appropriate options
const initBundleBuilder = (opts) => {
    const identityProvider = new sign_1.CIContextProvider(OIDC_AUDIENCE);
    const timeout = opts.timeout || DEFAULT_TIMEOUT;
    const retry = opts.retry || DEFAULT_RETRIES;
    const witnesses = [];
    const signer = new sign_1.FulcioSigner({
        identityProvider,
        fulcioBaseURL: opts.fulcioURL,
        timeout,
        retry
    });
    if (opts.rekorURL) {
        witnesses.push(new sign_1.RekorWitness({
            rekorBaseURL: opts.rekorURL,
            fetchOnConflict: true,
            timeout,
            retry
        }));
    }
    if (opts.tsaServerURL) {
        witnesses.push(new sign_1.TSAWitness({
            tsaBaseURL: opts.tsaServerURL,
            timeout,
            retry
        }));
    }
    // Build the bundle with the singleCertificate option which will
    // trigger the creation of v0.3 DSSE bundles
    return new sign_1.DSSEBundleBuilder({ signer, witnesses });
};
//# sourceMappingURL=sign.js.map

/***/ }),

/***/ 78740:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.writeAttestation = void 0;
const github = __importStar(__nccwpck_require__(93228));
const plugin_retry_1 = __nccwpck_require__(33450);
const CREATE_ATTESTATION_REQUEST = 'POST /repos/{owner}/{repo}/attestations';
const DEFAULT_RETRY_COUNT = 5;
/**
 * Writes an attestation to the repository's attestations endpoint.
 * @param attestation - The attestation to write.
 * @param token - The GitHub token for authentication.
 * @returns The ID of the attestation.
 * @throws Error if the attestation fails to persist.
 */
const writeAttestation = (attestation, token, options = {}) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const retries = (_a = options.retry) !== null && _a !== void 0 ? _a : DEFAULT_RETRY_COUNT;
    const octokit = github.getOctokit(token, { retry: { retries } }, plugin_retry_1.retry);
    try {
        const response = yield octokit.request(CREATE_ATTESTATION_REQUEST, {
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            headers: options.headers,
            data: { bundle: attestation }
        });
        const data = typeof response.data == 'string'
            ? JSON.parse(response.data)
            : response.data;
        return data === null || data === void 0 ? void 0 : data.id;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : err;
        throw new Error(`Failed to persist attestation: ${message}`);
    }
});
exports.writeAttestation = writeAttestation;
//# sourceMappingURL=store.js.map

/***/ }),

/***/ 44914:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.issue = exports.issueCommand = void 0;
const os = __importStar(__nccwpck_require__(70857));
const utils_1 = __nccwpck_require__(30302);
/**
 * Commands
 *
 * Command Format:
 *   ::name key=value,key=value::message
 *
 * Examples:
 *   ::warning::This is the message
 *   ::set-env name=MY_VAR::some value
 */
function issueCommand(command, properties, message) {
    const cmd = new Command(command, properties, message);
    process.stdout.write(cmd.toString() + os.EOL);
}
exports.issueCommand = issueCommand;
function issue(name, message = '') {
    issueCommand(name, {}, message);
}
exports.issue = issue;
const CMD_STRING = '::';
class Command {
    constructor(command, properties, message) {
        if (!command) {
            command = 'missing.command';
        }
        this.command = command;
        this.properties = properties;
        this.message = message;
    }
    toString() {
        let cmdStr = CMD_STRING + this.command;
        if (this.properties && Object.keys(this.properties).length > 0) {
            cmdStr += ' ';
            let first = true;
            for (const key in this.properties) {
                if (this.properties.hasOwnProperty(key)) {
                    const val = this.properties[key];
                    if (val) {
                        if (first) {
                            first = false;
                        }
                        else {
                            cmdStr += ',';
                        }
                        cmdStr += `${key}=${escapeProperty(val)}`;
                    }
                }
            }
        }
        cmdStr += `${CMD_STRING}${escapeData(this.message)}`;
        return cmdStr;
    }
}
function escapeData(s) {
    return (0, utils_1.toCommandValue)(s)
        .replace(/%/g, '%25')
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A');
}
function escapeProperty(s) {
    return (0, utils_1.toCommandValue)(s)
        .replace(/%/g, '%25')
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A')
        .replace(/:/g, '%3A')
        .replace(/,/g, '%2C');
}
//# sourceMappingURL=command.js.map

/***/ }),

/***/ 37484:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.platform = exports.toPlatformPath = exports.toWin32Path = exports.toPosixPath = exports.markdownSummary = exports.summary = exports.getIDToken = exports.getState = exports.saveState = exports.group = exports.endGroup = exports.startGroup = exports.info = exports.notice = exports.warning = exports.error = exports.debug = exports.isDebug = exports.setFailed = exports.setCommandEcho = exports.setOutput = exports.getBooleanInput = exports.getMultilineInput = exports.getInput = exports.addPath = exports.setSecret = exports.exportVariable = exports.ExitCode = void 0;
const command_1 = __nccwpck_require__(44914);
const file_command_1 = __nccwpck_require__(24753);
const utils_1 = __nccwpck_require__(30302);
const os = __importStar(__nccwpck_require__(70857));
const path = __importStar(__nccwpck_require__(16928));
const oidc_utils_1 = __nccwpck_require__(35306);
/**
 * The code to exit an action
 */
var ExitCode;
(function (ExitCode) {
    /**
     * A code indicating that the action was successful
     */
    ExitCode[ExitCode["Success"] = 0] = "Success";
    /**
     * A code indicating that the action was a failure
     */
    ExitCode[ExitCode["Failure"] = 1] = "Failure";
})(ExitCode || (exports.ExitCode = ExitCode = {}));
//-----------------------------------------------------------------------
// Variables
//-----------------------------------------------------------------------
/**
 * Sets env variable for this action and future actions in the job
 * @param name the name of the variable to set
 * @param val the value of the variable. Non-string values will be converted to a string via JSON.stringify
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exportVariable(name, val) {
    const convertedVal = (0, utils_1.toCommandValue)(val);
    process.env[name] = convertedVal;
    const filePath = process.env['GITHUB_ENV'] || '';
    if (filePath) {
        return (0, file_command_1.issueFileCommand)('ENV', (0, file_command_1.prepareKeyValueMessage)(name, val));
    }
    (0, command_1.issueCommand)('set-env', { name }, convertedVal);
}
exports.exportVariable = exportVariable;
/**
 * Registers a secret which will get masked from logs
 * @param secret value of the secret
 */
function setSecret(secret) {
    (0, command_1.issueCommand)('add-mask', {}, secret);
}
exports.setSecret = setSecret;
/**
 * Prepends inputPath to the PATH (for this action and future actions)
 * @param inputPath
 */
function addPath(inputPath) {
    const filePath = process.env['GITHUB_PATH'] || '';
    if (filePath) {
        (0, file_command_1.issueFileCommand)('PATH', inputPath);
    }
    else {
        (0, command_1.issueCommand)('add-path', {}, inputPath);
    }
    process.env['PATH'] = `${inputPath}${path.delimiter}${process.env['PATH']}`;
}
exports.addPath = addPath;
/**
 * Gets the value of an input.
 * Unless trimWhitespace is set to false in InputOptions, the value is also trimmed.
 * Returns an empty string if the value is not defined.
 *
 * @param     name     name of the input to get
 * @param     options  optional. See InputOptions.
 * @returns   string
 */
function getInput(name, options) {
    const val = process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] || '';
    if (options && options.required && !val) {
        throw new Error(`Input required and not supplied: ${name}`);
    }
    if (options && options.trimWhitespace === false) {
        return val;
    }
    return val.trim();
}
exports.getInput = getInput;
/**
 * Gets the values of an multiline input.  Each value is also trimmed.
 *
 * @param     name     name of the input to get
 * @param     options  optional. See InputOptions.
 * @returns   string[]
 *
 */
function getMultilineInput(name, options) {
    const inputs = getInput(name, options)
        .split('\n')
        .filter(x => x !== '');
    if (options && options.trimWhitespace === false) {
        return inputs;
    }
    return inputs.map(input => input.trim());
}
exports.getMultilineInput = getMultilineInput;
/**
 * Gets the input value of the boolean type in the YAML 1.2 "core schema" specification.
 * Support boolean input list: `true | True | TRUE | false | False | FALSE` .
 * The return value is also in boolean type.
 * ref: https://yaml.org/spec/1.2/spec.html#id2804923
 *
 * @param     name     name of the input to get
 * @param     options  optional. See InputOptions.
 * @returns   boolean
 */
function getBooleanInput(name, options) {
    const trueValue = ['true', 'True', 'TRUE'];
    const falseValue = ['false', 'False', 'FALSE'];
    const val = getInput(name, options);
    if (trueValue.includes(val))
        return true;
    if (falseValue.includes(val))
        return false;
    throw new TypeError(`Input does not meet YAML 1.2 "Core Schema" specification: ${name}\n` +
        `Support boolean input list: \`true | True | TRUE | false | False | FALSE\``);
}
exports.getBooleanInput = getBooleanInput;
/**
 * Sets the value of an output.
 *
 * @param     name     name of the output to set
 * @param     value    value to store. Non-string values will be converted to a string via JSON.stringify
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setOutput(name, value) {
    const filePath = process.env['GITHUB_OUTPUT'] || '';
    if (filePath) {
        return (0, file_command_1.issueFileCommand)('OUTPUT', (0, file_command_1.prepareKeyValueMessage)(name, value));
    }
    process.stdout.write(os.EOL);
    (0, command_1.issueCommand)('set-output', { name }, (0, utils_1.toCommandValue)(value));
}
exports.setOutput = setOutput;
/**
 * Enables or disables the echoing of commands into stdout for the rest of the step.
 * Echoing is disabled by default if ACTIONS_STEP_DEBUG is not set.
 *
 */
function setCommandEcho(enabled) {
    (0, command_1.issue)('echo', enabled ? 'on' : 'off');
}
exports.setCommandEcho = setCommandEcho;
//-----------------------------------------------------------------------
// Results
//-----------------------------------------------------------------------
/**
 * Sets the action status to failed.
 * When the action exits it will be with an exit code of 1
 * @param message add error issue message
 */
function setFailed(message) {
    process.exitCode = ExitCode.Failure;
    error(message);
}
exports.setFailed = setFailed;
//-----------------------------------------------------------------------
// Logging Commands
//-----------------------------------------------------------------------
/**
 * Gets whether Actions Step Debug is on or not
 */
function isDebug() {
    return process.env['RUNNER_DEBUG'] === '1';
}
exports.isDebug = isDebug;
/**
 * Writes debug message to user log
 * @param message debug message
 */
function debug(message) {
    (0, command_1.issueCommand)('debug', {}, message);
}
exports.debug = debug;
/**
 * Adds an error issue
 * @param message error issue message. Errors will be converted to string via toString()
 * @param properties optional properties to add to the annotation.
 */
function error(message, properties = {}) {
    (0, command_1.issueCommand)('error', (0, utils_1.toCommandProperties)(properties), message instanceof Error ? message.toString() : message);
}
exports.error = error;
/**
 * Adds a warning issue
 * @param message warning issue message. Errors will be converted to string via toString()
 * @param properties optional properties to add to the annotation.
 */
function warning(message, properties = {}) {
    (0, command_1.issueCommand)('warning', (0, utils_1.toCommandProperties)(properties), message instanceof Error ? message.toString() : message);
}
exports.warning = warning;
/**
 * Adds a notice issue
 * @param message notice issue message. Errors will be converted to string via toString()
 * @param properties optional properties to add to the annotation.
 */
function notice(message, properties = {}) {
    (0, command_1.issueCommand)('notice', (0, utils_1.toCommandProperties)(properties), message instanceof Error ? message.toString() : message);
}
exports.notice = notice;
/**
 * Writes info to log with console.log.
 * @param message info message
 */
function info(message) {
    process.stdout.write(message + os.EOL);
}
exports.info = info;
/**
 * Begin an output group.
 *
 * Output until the next `groupEnd` will be foldable in this group
 *
 * @param name The name of the output group
 */
function startGroup(name) {
    (0, command_1.issue)('group', name);
}
exports.startGroup = startGroup;
/**
 * End an output group.
 */
function endGroup() {
    (0, command_1.issue)('endgroup');
}
exports.endGroup = endGroup;
/**
 * Wrap an asynchronous function call in a group.
 *
 * Returns the same type as the function itself.
 *
 * @param name The name of the group
 * @param fn The function to wrap in the group
 */
function group(name, fn) {
    return __awaiter(this, void 0, void 0, function* () {
        startGroup(name);
        let result;
        try {
            result = yield fn();
        }
        finally {
            endGroup();
        }
        return result;
    });
}
exports.group = group;
//-----------------------------------------------------------------------
// Wrapper action state
//-----------------------------------------------------------------------
/**
 * Saves state for current action, the state can only be retrieved by this action's post job execution.
 *
 * @param     name     name of the state to store
 * @param     value    value to store. Non-string values will be converted to a string via JSON.stringify
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function saveState(name, value) {
    const filePath = process.env['GITHUB_STATE'] || '';
    if (filePath) {
        return (0, file_command_1.issueFileCommand)('STATE', (0, file_command_1.prepareKeyValueMessage)(name, value));
    }
    (0, command_1.issueCommand)('save-state', { name }, (0, utils_1.toCommandValue)(value));
}
exports.saveState = saveState;
/**
 * Gets the value of an state set by this action's main execution.
 *
 * @param     name     name of the state to get
 * @returns   string
 */
function getState(name) {
    return process.env[`STATE_${name}`] || '';
}
exports.getState = getState;
function getIDToken(aud) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield oidc_utils_1.OidcClient.getIDToken(aud);
    });
}
exports.getIDToken = getIDToken;
/**
 * Summary exports
 */
var summary_1 = __nccwpck_require__(71847);
Object.defineProperty(exports, "summary", ({ enumerable: true, get: function () { return summary_1.summary; } }));
/**
 * @deprecated use core.summary
 */
var summary_2 = __nccwpck_require__(71847);
Object.defineProperty(exports, "markdownSummary", ({ enumerable: true, get: function () { return summary_2.markdownSummary; } }));
/**
 * Path exports
 */
var path_utils_1 = __nccwpck_require__(31976);
Object.defineProperty(exports, "toPosixPath", ({ enumerable: true, get: function () { return path_utils_1.toPosixPath; } }));
Object.defineProperty(exports, "toWin32Path", ({ enumerable: true, get: function () { return path_utils_1.toWin32Path; } }));
Object.defineProperty(exports, "toPlatformPath", ({ enumerable: true, get: function () { return path_utils_1.toPlatformPath; } }));
/**
 * Platform utilities exports
 */
exports.platform = __importStar(__nccwpck_require__(18968));
//# sourceMappingURL=core.js.map

/***/ }),

/***/ 24753:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

// For internal use, subject to change.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.prepareKeyValueMessage = exports.issueFileCommand = void 0;
// We use any as a valid input type
/* eslint-disable @typescript-eslint/no-explicit-any */
const crypto = __importStar(__nccwpck_require__(76982));
const fs = __importStar(__nccwpck_require__(79896));
const os = __importStar(__nccwpck_require__(70857));
const utils_1 = __nccwpck_require__(30302);
function issueFileCommand(command, message) {
    const filePath = process.env[`GITHUB_${command}`];
    if (!filePath) {
        throw new Error(`Unable to find environment variable for file command ${command}`);
    }
    if (!fs.existsSync(filePath)) {
        throw new Error(`Missing file at path: ${filePath}`);
    }
    fs.appendFileSync(filePath, `${(0, utils_1.toCommandValue)(message)}${os.EOL}`, {
        encoding: 'utf8'
    });
}
exports.issueFileCommand = issueFileCommand;
function prepareKeyValueMessage(key, value) {
    const delimiter = `ghadelimiter_${crypto.randomUUID()}`;
    const convertedValue = (0, utils_1.toCommandValue)(value);
    // These should realistically never happen, but just in case someone finds a
    // way to exploit uuid generation let's not allow keys or values that contain
    // the delimiter.
    if (key.includes(delimiter)) {
        throw new Error(`Unexpected input: name should not contain the delimiter "${delimiter}"`);
    }
    if (convertedValue.includes(delimiter)) {
        throw new Error(`Unexpected input: value should not contain the delimiter "${delimiter}"`);
    }
    return `${key}<<${delimiter}${os.EOL}${convertedValue}${os.EOL}${delimiter}`;
}
exports.prepareKeyValueMessage = prepareKeyValueMessage;
//# sourceMappingURL=file-command.js.map

/***/ }),

/***/ 35306:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.OidcClient = void 0;
const http_client_1 = __nccwpck_require__(54844);
const auth_1 = __nccwpck_require__(44552);
const core_1 = __nccwpck_require__(37484);
class OidcClient {
    static createHttpClient(allowRetry = true, maxRetry = 10) {
        const requestOptions = {
            allowRetries: allowRetry,
            maxRetries: maxRetry
        };
        return new http_client_1.HttpClient('actions/oidc-client', [new auth_1.BearerCredentialHandler(OidcClient.getRequestToken())], requestOptions);
    }
    static getRequestToken() {
        const token = process.env['ACTIONS_ID_TOKEN_REQUEST_TOKEN'];
        if (!token) {
            throw new Error('Unable to get ACTIONS_ID_TOKEN_REQUEST_TOKEN env variable');
        }
        return token;
    }
    static getIDTokenUrl() {
        const runtimeUrl = process.env['ACTIONS_ID_TOKEN_REQUEST_URL'];
        if (!runtimeUrl) {
            throw new Error('Unable to get ACTIONS_ID_TOKEN_REQUEST_URL env variable');
        }
        return runtimeUrl;
    }
    static getCall(id_token_url) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const httpclient = OidcClient.createHttpClient();
            const res = yield httpclient
                .getJson(id_token_url)
                .catch(error => {
                throw new Error(`Failed to get ID Token. \n 
        Error Code : ${error.statusCode}\n 
        Error Message: ${error.message}`);
            });
            const id_token = (_a = res.result) === null || _a === void 0 ? void 0 : _a.value;
            if (!id_token) {
                throw new Error('Response json body do not have ID Token field');
            }
            return id_token;
        });
    }
    static getIDToken(audience) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // New ID Token is requested from action service
                let id_token_url = OidcClient.getIDTokenUrl();
                if (audience) {
                    const encodedAudience = encodeURIComponent(audience);
                    id_token_url = `${id_token_url}&audience=${encodedAudience}`;
                }
                (0, core_1.debug)(`ID token url is ${id_token_url}`);
                const id_token = yield OidcClient.getCall(id_token_url);
                (0, core_1.setSecret)(id_token);
                return id_token;
            }
            catch (error) {
                throw new Error(`Error message: ${error.message}`);
            }
        });
    }
}
exports.OidcClient = OidcClient;
//# sourceMappingURL=oidc-utils.js.map

/***/ }),

/***/ 31976:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.toPlatformPath = exports.toWin32Path = exports.toPosixPath = void 0;
const path = __importStar(__nccwpck_require__(16928));
/**
 * toPosixPath converts the given path to the posix form. On Windows, \\ will be
 * replaced with /.
 *
 * @param pth. Path to transform.
 * @return string Posix path.
 */
function toPosixPath(pth) {
    return pth.replace(/[\\]/g, '/');
}
exports.toPosixPath = toPosixPath;
/**
 * toWin32Path converts the given path to the win32 form. On Linux, / will be
 * replaced with \\.
 *
 * @param pth. Path to transform.
 * @return string Win32 path.
 */
function toWin32Path(pth) {
    return pth.replace(/[/]/g, '\\');
}
exports.toWin32Path = toWin32Path;
/**
 * toPlatformPath converts the given path to a platform-specific path. It does
 * this by replacing instances of / and \ with the platform-specific path
 * separator.
 *
 * @param pth The path to platformize.
 * @return string The platform-specific path.
 */
function toPlatformPath(pth) {
    return pth.replace(/[/\\]/g, path.sep);
}
exports.toPlatformPath = toPlatformPath;
//# sourceMappingURL=path-utils.js.map

/***/ }),

/***/ 18968:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getDetails = exports.isLinux = exports.isMacOS = exports.isWindows = exports.arch = exports.platform = void 0;
const os_1 = __importDefault(__nccwpck_require__(70857));
const exec = __importStar(__nccwpck_require__(95236));
const getWindowsInfo = () => __awaiter(void 0, void 0, void 0, function* () {
    const { stdout: version } = yield exec.getExecOutput('powershell -command "(Get-CimInstance -ClassName Win32_OperatingSystem).Version"', undefined, {
        silent: true
    });
    const { stdout: name } = yield exec.getExecOutput('powershell -command "(Get-CimInstance -ClassName Win32_OperatingSystem).Caption"', undefined, {
        silent: true
    });
    return {
        name: name.trim(),
        version: version.trim()
    };
});
const getMacOsInfo = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const { stdout } = yield exec.getExecOutput('sw_vers', undefined, {
        silent: true
    });
    const version = (_b = (_a = stdout.match(/ProductVersion:\s*(.+)/)) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : '';
    const name = (_d = (_c = stdout.match(/ProductName:\s*(.+)/)) === null || _c === void 0 ? void 0 : _c[1]) !== null && _d !== void 0 ? _d : '';
    return {
        name,
        version
    };
});
const getLinuxInfo = () => __awaiter(void 0, void 0, void 0, function* () {
    const { stdout } = yield exec.getExecOutput('lsb_release', ['-i', '-r', '-s'], {
        silent: true
    });
    const [name, version] = stdout.trim().split('\n');
    return {
        name,
        version
    };
});
exports.platform = os_1.default.platform();
exports.arch = os_1.default.arch();
exports.isWindows = exports.platform === 'win32';
exports.isMacOS = exports.platform === 'darwin';
exports.isLinux = exports.platform === 'linux';
function getDetails() {
    return __awaiter(this, void 0, void 0, function* () {
        return Object.assign(Object.assign({}, (yield (exports.isWindows
            ? getWindowsInfo()
            : exports.isMacOS
                ? getMacOsInfo()
                : getLinuxInfo()))), { platform: exports.platform,
            arch: exports.arch,
            isWindows: exports.isWindows,
            isMacOS: exports.isMacOS,
            isLinux: exports.isLinux });
    });
}
exports.getDetails = getDetails;
//# sourceMappingURL=platform.js.map

/***/ }),

/***/ 71847:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.summary = exports.markdownSummary = exports.SUMMARY_DOCS_URL = exports.SUMMARY_ENV_VAR = void 0;
const os_1 = __nccwpck_require__(70857);
const fs_1 = __nccwpck_require__(79896);
const { access, appendFile, writeFile } = fs_1.promises;
exports.SUMMARY_ENV_VAR = 'GITHUB_STEP_SUMMARY';
exports.SUMMARY_DOCS_URL = 'https://docs.github.com/actions/using-workflows/workflow-commands-for-github-actions#adding-a-job-summary';
class Summary {
    constructor() {
        this._buffer = '';
    }
    /**
     * Finds the summary file path from the environment, rejects if env var is not found or file does not exist
     * Also checks r/w permissions.
     *
     * @returns step summary file path
     */
    filePath() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._filePath) {
                return this._filePath;
            }
            const pathFromEnv = process.env[exports.SUMMARY_ENV_VAR];
            if (!pathFromEnv) {
                throw new Error(`Unable to find environment variable for $${exports.SUMMARY_ENV_VAR}. Check if your runtime environment supports job summaries.`);
            }
            try {
                yield access(pathFromEnv, fs_1.constants.R_OK | fs_1.constants.W_OK);
            }
            catch (_a) {
                throw new Error(`Unable to access summary file: '${pathFromEnv}'. Check if the file has correct read/write permissions.`);
            }
            this._filePath = pathFromEnv;
            return this._filePath;
        });
    }
    /**
     * Wraps content in an HTML tag, adding any HTML attributes
     *
     * @param {string} tag HTML tag to wrap
     * @param {string | null} content content within the tag
     * @param {[attribute: string]: string} attrs key-value list of HTML attributes to add
     *
     * @returns {string} content wrapped in HTML element
     */
    wrap(tag, content, attrs = {}) {
        const htmlAttrs = Object.entries(attrs)
            .map(([key, value]) => ` ${key}="${value}"`)
            .join('');
        if (!content) {
            return `<${tag}${htmlAttrs}>`;
        }
        return `<${tag}${htmlAttrs}>${content}</${tag}>`;
    }
    /**
     * Writes text in the buffer to the summary buffer file and empties buffer. Will append by default.
     *
     * @param {SummaryWriteOptions} [options] (optional) options for write operation
     *
     * @returns {Promise<Summary>} summary instance
     */
    write(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const overwrite = !!(options === null || options === void 0 ? void 0 : options.overwrite);
            const filePath = yield this.filePath();
            const writeFunc = overwrite ? writeFile : appendFile;
            yield writeFunc(filePath, this._buffer, { encoding: 'utf8' });
            return this.emptyBuffer();
        });
    }
    /**
     * Clears the summary buffer and wipes the summary file
     *
     * @returns {Summary} summary instance
     */
    clear() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.emptyBuffer().write({ overwrite: true });
        });
    }
    /**
     * Returns the current summary buffer as a string
     *
     * @returns {string} string of summary buffer
     */
    stringify() {
        return this._buffer;
    }
    /**
     * If the summary buffer is empty
     *
     * @returns {boolen} true if the buffer is empty
     */
    isEmptyBuffer() {
        return this._buffer.length === 0;
    }
    /**
     * Resets the summary buffer without writing to summary file
     *
     * @returns {Summary} summary instance
     */
    emptyBuffer() {
        this._buffer = '';
        return this;
    }
    /**
     * Adds raw text to the summary buffer
     *
     * @param {string} text content to add
     * @param {boolean} [addEOL=false] (optional) append an EOL to the raw text (default: false)
     *
     * @returns {Summary} summary instance
     */
    addRaw(text, addEOL = false) {
        this._buffer += text;
        return addEOL ? this.addEOL() : this;
    }
    /**
     * Adds the operating system-specific end-of-line marker to the buffer
     *
     * @returns {Summary} summary instance
     */
    addEOL() {
        return this.addRaw(os_1.EOL);
    }
    /**
     * Adds an HTML codeblock to the summary buffer
     *
     * @param {string} code content to render within fenced code block
     * @param {string} lang (optional) language to syntax highlight code
     *
     * @returns {Summary} summary instance
     */
    addCodeBlock(code, lang) {
        const attrs = Object.assign({}, (lang && { lang }));
        const element = this.wrap('pre', this.wrap('code', code), attrs);
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds an HTML list to the summary buffer
     *
     * @param {string[]} items list of items to render
     * @param {boolean} [ordered=false] (optional) if the rendered list should be ordered or not (default: false)
     *
     * @returns {Summary} summary instance
     */
    addList(items, ordered = false) {
        const tag = ordered ? 'ol' : 'ul';
        const listItems = items.map(item => this.wrap('li', item)).join('');
        const element = this.wrap(tag, listItems);
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds an HTML table to the summary buffer
     *
     * @param {SummaryTableCell[]} rows table rows
     *
     * @returns {Summary} summary instance
     */
    addTable(rows) {
        const tableBody = rows
            .map(row => {
            const cells = row
                .map(cell => {
                if (typeof cell === 'string') {
                    return this.wrap('td', cell);
                }
                const { header, data, colspan, rowspan } = cell;
                const tag = header ? 'th' : 'td';
                const attrs = Object.assign(Object.assign({}, (colspan && { colspan })), (rowspan && { rowspan }));
                return this.wrap(tag, data, attrs);
            })
                .join('');
            return this.wrap('tr', cells);
        })
            .join('');
        const element = this.wrap('table', tableBody);
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds a collapsable HTML details element to the summary buffer
     *
     * @param {string} label text for the closed state
     * @param {string} content collapsable content
     *
     * @returns {Summary} summary instance
     */
    addDetails(label, content) {
        const element = this.wrap('details', this.wrap('summary', label) + content);
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds an HTML image tag to the summary buffer
     *
     * @param {string} src path to the image you to embed
     * @param {string} alt text description of the image
     * @param {SummaryImageOptions} options (optional) addition image attributes
     *
     * @returns {Summary} summary instance
     */
    addImage(src, alt, options) {
        const { width, height } = options || {};
        const attrs = Object.assign(Object.assign({}, (width && { width })), (height && { height }));
        const element = this.wrap('img', null, Object.assign({ src, alt }, attrs));
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds an HTML section heading element
     *
     * @param {string} text heading text
     * @param {number | string} [level=1] (optional) the heading level, default: 1
     *
     * @returns {Summary} summary instance
     */
    addHeading(text, level) {
        const tag = `h${level}`;
        const allowedTag = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)
            ? tag
            : 'h1';
        const element = this.wrap(allowedTag, text);
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds an HTML thematic break (<hr>) to the summary buffer
     *
     * @returns {Summary} summary instance
     */
    addSeparator() {
        const element = this.wrap('hr', null);
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds an HTML line break (<br>) to the summary buffer
     *
     * @returns {Summary} summary instance
     */
    addBreak() {
        const element = this.wrap('br', null);
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds an HTML blockquote to the summary buffer
     *
     * @param {string} text quote text
     * @param {string} cite (optional) citation url
     *
     * @returns {Summary} summary instance
     */
    addQuote(text, cite) {
        const attrs = Object.assign({}, (cite && { cite }));
        const element = this.wrap('blockquote', text, attrs);
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds an HTML anchor tag to the summary buffer
     *
     * @param {string} text link text/content
     * @param {string} href hyperlink
     *
     * @returns {Summary} summary instance
     */
    addLink(text, href) {
        const element = this.wrap('a', text, { href });
        return this.addRaw(element).addEOL();
    }
}
const _summary = new Summary();
/**
 * @deprecated use `core.summary`
 */
exports.markdownSummary = _summary;
exports.summary = _summary;
//# sourceMappingURL=summary.js.map

/***/ }),

/***/ 30302:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

// We use any as a valid input type
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.toCommandProperties = exports.toCommandValue = void 0;
/**
 * Sanitizes an input into a string so it can be passed into issueCommand safely
 * @param input input to sanitize into a string
 */
function toCommandValue(input) {
    if (input === null || input === undefined) {
        return '';
    }
    else if (typeof input === 'string' || input instanceof String) {
        return input;
    }
    return JSON.stringify(input);
}
exports.toCommandValue = toCommandValue;
/**
 *
 * @param annotationProperties
 * @returns The command properties to send with the actual annotation command
 * See IssueCommandProperties: https://github.com/actions/runner/blob/main/src/Runner.Worker/ActionCommandManager.cs#L646
 */
function toCommandProperties(annotationProperties) {
    if (!Object.keys(annotationProperties).length) {
        return {};
    }
    return {
        title: annotationProperties.title,
        file: annotationProperties.file,
        line: annotationProperties.startLine,
        endLine: annotationProperties.endLine,
        col: annotationProperties.startColumn,
        endColumn: annotationProperties.endColumn
    };
}
exports.toCommandProperties = toCommandProperties;
//# sourceMappingURL=utils.js.map

/***/ }),

/***/ 95236:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getExecOutput = exports.exec = void 0;
const string_decoder_1 = __nccwpck_require__(13193);
const tr = __importStar(__nccwpck_require__(6665));
/**
 * Exec a command.
 * Output will be streamed to the live console.
 * Returns promise with return code
 *
 * @param     commandLine        command to execute (can include additional args). Must be correctly escaped.
 * @param     args               optional arguments for tool. Escaping is handled by the lib.
 * @param     options            optional exec options.  See ExecOptions
 * @returns   Promise<number>    exit code
 */
function exec(commandLine, args, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const commandArgs = tr.argStringToArray(commandLine);
        if (commandArgs.length === 0) {
            throw new Error(`Parameter 'commandLine' cannot be null or empty.`);
        }
        // Path to tool to execute should be first arg
        const toolPath = commandArgs[0];
        args = commandArgs.slice(1).concat(args || []);
        const runner = new tr.ToolRunner(toolPath, args, options);
        return runner.exec();
    });
}
exports.exec = exec;
/**
 * Exec a command and get the output.
 * Output will be streamed to the live console.
 * Returns promise with the exit code and collected stdout and stderr
 *
 * @param     commandLine           command to execute (can include additional args). Must be correctly escaped.
 * @param     args                  optional arguments for tool. Escaping is handled by the lib.
 * @param     options               optional exec options.  See ExecOptions
 * @returns   Promise<ExecOutput>   exit code, stdout, and stderr
 */
function getExecOutput(commandLine, args, options) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        let stdout = '';
        let stderr = '';
        //Using string decoder covers the case where a mult-byte character is split
        const stdoutDecoder = new string_decoder_1.StringDecoder('utf8');
        const stderrDecoder = new string_decoder_1.StringDecoder('utf8');
        const originalStdoutListener = (_a = options === null || options === void 0 ? void 0 : options.listeners) === null || _a === void 0 ? void 0 : _a.stdout;
        const originalStdErrListener = (_b = options === null || options === void 0 ? void 0 : options.listeners) === null || _b === void 0 ? void 0 : _b.stderr;
        const stdErrListener = (data) => {
            stderr += stderrDecoder.write(data);
            if (originalStdErrListener) {
                originalStdErrListener(data);
            }
        };
        const stdOutListener = (data) => {
            stdout += stdoutDecoder.write(data);
            if (originalStdoutListener) {
                originalStdoutListener(data);
            }
        };
        const listeners = Object.assign(Object.assign({}, options === null || options === void 0 ? void 0 : options.listeners), { stdout: stdOutListener, stderr: stdErrListener });
        const exitCode = yield exec(commandLine, args, Object.assign(Object.assign({}, options), { listeners }));
        //flush any remaining characters
        stdout += stdoutDecoder.end();
        stderr += stderrDecoder.end();
        return {
            exitCode,
            stdout,
            stderr
        };
    });
}
exports.getExecOutput = getExecOutput;
//# sourceMappingURL=exec.js.map

/***/ }),

/***/ 6665:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.argStringToArray = exports.ToolRunner = void 0;
const os = __importStar(__nccwpck_require__(70857));
const events = __importStar(__nccwpck_require__(24434));
const child = __importStar(__nccwpck_require__(35317));
const path = __importStar(__nccwpck_require__(16928));
const io = __importStar(__nccwpck_require__(94994));
const ioUtil = __importStar(__nccwpck_require__(75207));
const timers_1 = __nccwpck_require__(53557);
/* eslint-disable @typescript-eslint/unbound-method */
const IS_WINDOWS = process.platform === 'win32';
/*
 * Class for running command line tools. Handles quoting and arg parsing in a platform agnostic way.
 */
class ToolRunner extends events.EventEmitter {
    constructor(toolPath, args, options) {
        super();
        if (!toolPath) {
            throw new Error("Parameter 'toolPath' cannot be null or empty.");
        }
        this.toolPath = toolPath;
        this.args = args || [];
        this.options = options || {};
    }
    _debug(message) {
        if (this.options.listeners && this.options.listeners.debug) {
            this.options.listeners.debug(message);
        }
    }
    _getCommandString(options, noPrefix) {
        const toolPath = this._getSpawnFileName();
        const args = this._getSpawnArgs(options);
        let cmd = noPrefix ? '' : '[command]'; // omit prefix when piped to a second tool
        if (IS_WINDOWS) {
            // Windows + cmd file
            if (this._isCmdFile()) {
                cmd += toolPath;
                for (const a of args) {
                    cmd += ` ${a}`;
                }
            }
            // Windows + verbatim
            else if (options.windowsVerbatimArguments) {
                cmd += `"${toolPath}"`;
                for (const a of args) {
                    cmd += ` ${a}`;
                }
            }
            // Windows (regular)
            else {
                cmd += this._windowsQuoteCmdArg(toolPath);
                for (const a of args) {
                    cmd += ` ${this._windowsQuoteCmdArg(a)}`;
                }
            }
        }
        else {
            // OSX/Linux - this can likely be improved with some form of quoting.
            // creating processes on Unix is fundamentally different than Windows.
            // on Unix, execvp() takes an arg array.
            cmd += toolPath;
            for (const a of args) {
                cmd += ` ${a}`;
            }
        }
        return cmd;
    }
    _processLineBuffer(data, strBuffer, onLine) {
        try {
            let s = strBuffer + data.toString();
            let n = s.indexOf(os.EOL);
            while (n > -1) {
                const line = s.substring(0, n);
                onLine(line);
                // the rest of the string ...
                s = s.substring(n + os.EOL.length);
                n = s.indexOf(os.EOL);
            }
            return s;
        }
        catch (err) {
            // streaming lines to console is best effort.  Don't fail a build.
            this._debug(`error processing line. Failed with error ${err}`);
            return '';
        }
    }
    _getSpawnFileName() {
        if (IS_WINDOWS) {
            if (this._isCmdFile()) {
                return process.env['COMSPEC'] || 'cmd.exe';
            }
        }
        return this.toolPath;
    }
    _getSpawnArgs(options) {
        if (IS_WINDOWS) {
            if (this._isCmdFile()) {
                let argline = `/D /S /C "${this._windowsQuoteCmdArg(this.toolPath)}`;
                for (const a of this.args) {
                    argline += ' ';
                    argline += options.windowsVerbatimArguments
                        ? a
                        : this._windowsQuoteCmdArg(a);
                }
                argline += '"';
                return [argline];
            }
        }
        return this.args;
    }
    _endsWith(str, end) {
        return str.endsWith(end);
    }
    _isCmdFile() {
        const upperToolPath = this.toolPath.toUpperCase();
        return (this._endsWith(upperToolPath, '.CMD') ||
            this._endsWith(upperToolPath, '.BAT'));
    }
    _windowsQuoteCmdArg(arg) {
        // for .exe, apply the normal quoting rules that libuv applies
        if (!this._isCmdFile()) {
            return this._uvQuoteCmdArg(arg);
        }
        // otherwise apply quoting rules specific to the cmd.exe command line parser.
        // the libuv rules are generic and are not designed specifically for cmd.exe
        // command line parser.
        //
        // for a detailed description of the cmd.exe command line parser, refer to
        // http://stackoverflow.com/questions/4094699/how-does-the-windows-command-interpreter-cmd-exe-parse-scripts/7970912#7970912
        // need quotes for empty arg
        if (!arg) {
            return '""';
        }
        // determine whether the arg needs to be quoted
        const cmdSpecialChars = [
            ' ',
            '\t',
            '&',
            '(',
            ')',
            '[',
            ']',
            '{',
            '}',
            '^',
            '=',
            ';',
            '!',
            "'",
            '+',
            ',',
            '`',
            '~',
            '|',
            '<',
            '>',
            '"'
        ];
        let needsQuotes = false;
        for (const char of arg) {
            if (cmdSpecialChars.some(x => x === char)) {
                needsQuotes = true;
                break;
            }
        }
        // short-circuit if quotes not needed
        if (!needsQuotes) {
            return arg;
        }
        // the following quoting rules are very similar to the rules that by libuv applies.
        //
        // 1) wrap the string in quotes
        //
        // 2) double-up quotes - i.e. " => ""
        //
        //    this is different from the libuv quoting rules. libuv replaces " with \", which unfortunately
        //    doesn't work well with a cmd.exe command line.
        //
        //    note, replacing " with "" also works well if the arg is passed to a downstream .NET console app.
        //    for example, the command line:
        //          foo.exe "myarg:""my val"""
        //    is parsed by a .NET console app into an arg array:
        //          [ "myarg:\"my val\"" ]
        //    which is the same end result when applying libuv quoting rules. although the actual
        //    command line from libuv quoting rules would look like:
        //          foo.exe "myarg:\"my val\""
        //
        // 3) double-up slashes that precede a quote,
        //    e.g.  hello \world    => "hello \world"
        //          hello\"world    => "hello\\""world"
        //          hello\\"world   => "hello\\\\""world"
        //          hello world\    => "hello world\\"
        //
        //    technically this is not required for a cmd.exe command line, or the batch argument parser.
        //    the reasons for including this as a .cmd quoting rule are:
        //
        //    a) this is optimized for the scenario where the argument is passed from the .cmd file to an
        //       external program. many programs (e.g. .NET console apps) rely on the slash-doubling rule.
        //
        //    b) it's what we've been doing previously (by deferring to node default behavior) and we
        //       haven't heard any complaints about that aspect.
        //
        // note, a weakness of the quoting rules chosen here, is that % is not escaped. in fact, % cannot be
        // escaped when used on the command line directly - even though within a .cmd file % can be escaped
        // by using %%.
        //
        // the saving grace is, on the command line, %var% is left as-is if var is not defined. this contrasts
        // the line parsing rules within a .cmd file, where if var is not defined it is replaced with nothing.
        //
        // one option that was explored was replacing % with ^% - i.e. %var% => ^%var^%. this hack would
        // often work, since it is unlikely that var^ would exist, and the ^ character is removed when the
        // variable is used. the problem, however, is that ^ is not removed when %* is used to pass the args
        // to an external program.
        //
        // an unexplored potential solution for the % escaping problem, is to create a wrapper .cmd file.
        // % can be escaped within a .cmd file.
        let reverse = '"';
        let quoteHit = true;
        for (let i = arg.length; i > 0; i--) {
            // walk the string in reverse
            reverse += arg[i - 1];
            if (quoteHit && arg[i - 1] === '\\') {
                reverse += '\\'; // double the slash
            }
            else if (arg[i - 1] === '"') {
                quoteHit = true;
                reverse += '"'; // double the quote
            }
            else {
                quoteHit = false;
            }
        }
        reverse += '"';
        return reverse
            .split('')
            .reverse()
            .join('');
    }
    _uvQuoteCmdArg(arg) {
        // Tool runner wraps child_process.spawn() and needs to apply the same quoting as
        // Node in certain cases where the undocumented spawn option windowsVerbatimArguments
        // is used.
        //
        // Since this function is a port of quote_cmd_arg from Node 4.x (technically, lib UV,
        // see https://github.com/nodejs/node/blob/v4.x/deps/uv/src/win/process.c for details),
        // pasting copyright notice from Node within this function:
        //
        //      Copyright Joyent, Inc. and other Node contributors. All rights reserved.
        //
        //      Permission is hereby granted, free of charge, to any person obtaining a copy
        //      of this software and associated documentation files (the "Software"), to
        //      deal in the Software without restriction, including without limitation the
        //      rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
        //      sell copies of the Software, and to permit persons to whom the Software is
        //      furnished to do so, subject to the following conditions:
        //
        //      The above copyright notice and this permission notice shall be included in
        //      all copies or substantial portions of the Software.
        //
        //      THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
        //      IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
        //      FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
        //      AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
        //      LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
        //      FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
        //      IN THE SOFTWARE.
        if (!arg) {
            // Need double quotation for empty argument
            return '""';
        }
        if (!arg.includes(' ') && !arg.includes('\t') && !arg.includes('"')) {
            // No quotation needed
            return arg;
        }
        if (!arg.includes('"') && !arg.includes('\\')) {
            // No embedded double quotes or backslashes, so I can just wrap
            // quote marks around the whole thing.
            return `"${arg}"`;
        }
        // Expected input/output:
        //   input : hello"world
        //   output: "hello\"world"
        //   input : hello""world
        //   output: "hello\"\"world"
        //   input : hello\world
        //   output: hello\world
        //   input : hello\\world
        //   output: hello\\world
        //   input : hello\"world
        //   output: "hello\\\"world"
        //   input : hello\\"world
        //   output: "hello\\\\\"world"
        //   input : hello world\
        //   output: "hello world\\" - note the comment in libuv actually reads "hello world\"
        //                             but it appears the comment is wrong, it should be "hello world\\"
        let reverse = '"';
        let quoteHit = true;
        for (let i = arg.length; i > 0; i--) {
            // walk the string in reverse
            reverse += arg[i - 1];
            if (quoteHit && arg[i - 1] === '\\') {
                reverse += '\\';
            }
            else if (arg[i - 1] === '"') {
                quoteHit = true;
                reverse += '\\';
            }
            else {
                quoteHit = false;
            }
        }
        reverse += '"';
        return reverse
            .split('')
            .reverse()
            .join('');
    }
    _cloneExecOptions(options) {
        options = options || {};
        const result = {
            cwd: options.cwd || process.cwd(),
            env: options.env || process.env,
            silent: options.silent || false,
            windowsVerbatimArguments: options.windowsVerbatimArguments || false,
            failOnStdErr: options.failOnStdErr || false,
            ignoreReturnCode: options.ignoreReturnCode || false,
            delay: options.delay || 10000
        };
        result.outStream = options.outStream || process.stdout;
        result.errStream = options.errStream || process.stderr;
        return result;
    }
    _getSpawnOptions(options, toolPath) {
        options = options || {};
        const result = {};
        result.cwd = options.cwd;
        result.env = options.env;
        result['windowsVerbatimArguments'] =
            options.windowsVerbatimArguments || this._isCmdFile();
        if (options.windowsVerbatimArguments) {
            result.argv0 = `"${toolPath}"`;
        }
        return result;
    }
    /**
     * Exec a tool.
     * Output will be streamed to the live console.
     * Returns promise with return code
     *
     * @param     tool     path to tool to exec
     * @param     options  optional exec options.  See ExecOptions
     * @returns   number
     */
    exec() {
        return __awaiter(this, void 0, void 0, function* () {
            // root the tool path if it is unrooted and contains relative pathing
            if (!ioUtil.isRooted(this.toolPath) &&
                (this.toolPath.includes('/') ||
                    (IS_WINDOWS && this.toolPath.includes('\\')))) {
                // prefer options.cwd if it is specified, however options.cwd may also need to be rooted
                this.toolPath = path.resolve(process.cwd(), this.options.cwd || process.cwd(), this.toolPath);
            }
            // if the tool is only a file name, then resolve it from the PATH
            // otherwise verify it exists (add extension on Windows if necessary)
            this.toolPath = yield io.which(this.toolPath, true);
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                this._debug(`exec tool: ${this.toolPath}`);
                this._debug('arguments:');
                for (const arg of this.args) {
                    this._debug(`   ${arg}`);
                }
                const optionsNonNull = this._cloneExecOptions(this.options);
                if (!optionsNonNull.silent && optionsNonNull.outStream) {
                    optionsNonNull.outStream.write(this._getCommandString(optionsNonNull) + os.EOL);
                }
                const state = new ExecState(optionsNonNull, this.toolPath);
                state.on('debug', (message) => {
                    this._debug(message);
                });
                if (this.options.cwd && !(yield ioUtil.exists(this.options.cwd))) {
                    return reject(new Error(`The cwd: ${this.options.cwd} does not exist!`));
                }
                const fileName = this._getSpawnFileName();
                const cp = child.spawn(fileName, this._getSpawnArgs(optionsNonNull), this._getSpawnOptions(this.options, fileName));
                let stdbuffer = '';
                if (cp.stdout) {
                    cp.stdout.on('data', (data) => {
                        if (this.options.listeners && this.options.listeners.stdout) {
                            this.options.listeners.stdout(data);
                        }
                        if (!optionsNonNull.silent && optionsNonNull.outStream) {
                            optionsNonNull.outStream.write(data);
                        }
                        stdbuffer = this._processLineBuffer(data, stdbuffer, (line) => {
                            if (this.options.listeners && this.options.listeners.stdline) {
                                this.options.listeners.stdline(line);
                            }
                        });
                    });
                }
                let errbuffer = '';
                if (cp.stderr) {
                    cp.stderr.on('data', (data) => {
                        state.processStderr = true;
                        if (this.options.listeners && this.options.listeners.stderr) {
                            this.options.listeners.stderr(data);
                        }
                        if (!optionsNonNull.silent &&
                            optionsNonNull.errStream &&
                            optionsNonNull.outStream) {
                            const s = optionsNonNull.failOnStdErr
                                ? optionsNonNull.errStream
                                : optionsNonNull.outStream;
                            s.write(data);
                        }
                        errbuffer = this._processLineBuffer(data, errbuffer, (line) => {
                            if (this.options.listeners && this.options.listeners.errline) {
                                this.options.listeners.errline(line);
                            }
                        });
                    });
                }
                cp.on('error', (err) => {
                    state.processError = err.message;
                    state.processExited = true;
                    state.processClosed = true;
                    state.CheckComplete();
                });
                cp.on('exit', (code) => {
                    state.processExitCode = code;
                    state.processExited = true;
                    this._debug(`Exit code ${code} received from tool '${this.toolPath}'`);
                    state.CheckComplete();
                });
                cp.on('close', (code) => {
                    state.processExitCode = code;
                    state.processExited = true;
                    state.processClosed = true;
                    this._debug(`STDIO streams have closed for tool '${this.toolPath}'`);
                    state.CheckComplete();
                });
                state.on('done', (error, exitCode) => {
                    if (stdbuffer.length > 0) {
                        this.emit('stdline', stdbuffer);
                    }
                    if (errbuffer.length > 0) {
                        this.emit('errline', errbuffer);
                    }
                    cp.removeAllListeners();
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve(exitCode);
                    }
                });
                if (this.options.input) {
                    if (!cp.stdin) {
                        throw new Error('child process missing stdin');
                    }
                    cp.stdin.end(this.options.input);
                }
            }));
        });
    }
}
exports.ToolRunner = ToolRunner;
/**
 * Convert an arg string to an array of args. Handles escaping
 *
 * @param    argString   string of arguments
 * @returns  string[]    array of arguments
 */
function argStringToArray(argString) {
    const args = [];
    let inQuotes = false;
    let escaped = false;
    let arg = '';
    function append(c) {
        // we only escape double quotes.
        if (escaped && c !== '"') {
            arg += '\\';
        }
        arg += c;
        escaped = false;
    }
    for (let i = 0; i < argString.length; i++) {
        const c = argString.charAt(i);
        if (c === '"') {
            if (!escaped) {
                inQuotes = !inQuotes;
            }
            else {
                append(c);
            }
            continue;
        }
        if (c === '\\' && escaped) {
            append(c);
            continue;
        }
        if (c === '\\' && inQuotes) {
            escaped = true;
            continue;
        }
        if (c === ' ' && !inQuotes) {
            if (arg.length > 0) {
                args.push(arg);
                arg = '';
            }
            continue;
        }
        append(c);
    }
    if (arg.length > 0) {
        args.push(arg.trim());
    }
    return args;
}
exports.argStringToArray = argStringToArray;
class ExecState extends events.EventEmitter {
    constructor(options, toolPath) {
        super();
        this.processClosed = false; // tracks whether the process has exited and stdio is closed
        this.processError = '';
        this.processExitCode = 0;
        this.processExited = false; // tracks whether the process has exited
        this.processStderr = false; // tracks whether stderr was written to
        this.delay = 10000; // 10 seconds
        this.done = false;
        this.timeout = null;
        if (!toolPath) {
            throw new Error('toolPath must not be empty');
        }
        this.options = options;
        this.toolPath = toolPath;
        if (options.delay) {
            this.delay = options.delay;
        }
    }
    CheckComplete() {
        if (this.done) {
            return;
        }
        if (this.processClosed) {
            this._setResult();
        }
        else if (this.processExited) {
            this.timeout = timers_1.setTimeout(ExecState.HandleTimeout, this.delay, this);
        }
    }
    _debug(message) {
        this.emit('debug', message);
    }
    _setResult() {
        // determine whether there is an error
        let error;
        if (this.processExited) {
            if (this.processError) {
                error = new Error(`There was an error when attempting to execute the process '${this.toolPath}'. This may indicate the process failed to start. Error: ${this.processError}`);
            }
            else if (this.processExitCode !== 0 && !this.options.ignoreReturnCode) {
                error = new Error(`The process '${this.toolPath}' failed with exit code ${this.processExitCode}`);
            }
            else if (this.processStderr && this.options.failOnStdErr) {
                error = new Error(`The process '${this.toolPath}' failed because one or more lines were written to the STDERR stream`);
            }
        }
        // clear the timeout
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        this.done = true;
        this.emit('done', error, this.processExitCode);
    }
    static HandleTimeout(state) {
        if (state.done) {
            return;
        }
        if (!state.processClosed && state.processExited) {
            const message = `The STDIO streams did not close within ${state.delay /
                1000} seconds of the exit event from process '${state.toolPath}'. This may indicate a child process inherited the STDIO streams and has not yet exited.`;
            state._debug(message);
        }
        state._setResult();
    }
}
//# sourceMappingURL=toolrunner.js.map

/***/ }),

/***/ 51648:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Context = void 0;
const fs_1 = __nccwpck_require__(79896);
const os_1 = __nccwpck_require__(70857);
class Context {
    /**
     * Hydrate the context from the environment
     */
    constructor() {
        var _a, _b, _c;
        this.payload = {};
        if (process.env.GITHUB_EVENT_PATH) {
            if ((0, fs_1.existsSync)(process.env.GITHUB_EVENT_PATH)) {
                this.payload = JSON.parse((0, fs_1.readFileSync)(process.env.GITHUB_EVENT_PATH, { encoding: 'utf8' }));
            }
            else {
                const path = process.env.GITHUB_EVENT_PATH;
                process.stdout.write(`GITHUB_EVENT_PATH ${path} does not exist${os_1.EOL}`);
            }
        }
        this.eventName = process.env.GITHUB_EVENT_NAME;
        this.sha = process.env.GITHUB_SHA;
        this.ref = process.env.GITHUB_REF;
        this.workflow = process.env.GITHUB_WORKFLOW;
        this.action = process.env.GITHUB_ACTION;
        this.actor = process.env.GITHUB_ACTOR;
        this.job = process.env.GITHUB_JOB;
        this.runAttempt = parseInt(process.env.GITHUB_RUN_ATTEMPT, 10);
        this.runNumber = parseInt(process.env.GITHUB_RUN_NUMBER, 10);
        this.runId = parseInt(process.env.GITHUB_RUN_ID, 10);
        this.apiUrl = (_a = process.env.GITHUB_API_URL) !== null && _a !== void 0 ? _a : `https://api.github.com`;
        this.serverUrl = (_b = process.env.GITHUB_SERVER_URL) !== null && _b !== void 0 ? _b : `https://github.com`;
        this.graphqlUrl =
            (_c = process.env.GITHUB_GRAPHQL_URL) !== null && _c !== void 0 ? _c : `https://api.github.com/graphql`;
    }
    get issue() {
        const payload = this.payload;
        return Object.assign(Object.assign({}, this.repo), { number: (payload.issue || payload.pull_request || payload).number });
    }
    get repo() {
        if (process.env.GITHUB_REPOSITORY) {
            const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
            return { owner, repo };
        }
        if (this.payload.repository) {
            return {
                owner: this.payload.repository.owner.login,
                repo: this.payload.repository.name
            };
        }
        throw new Error("context.repo requires a GITHUB_REPOSITORY environment variable like 'owner/repo'");
    }
}
exports.Context = Context;
//# sourceMappingURL=context.js.map

/***/ }),

/***/ 93228:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getOctokit = exports.context = void 0;
const Context = __importStar(__nccwpck_require__(51648));
const utils_1 = __nccwpck_require__(38006);
exports.context = new Context.Context();
/**
 * Returns a hydrated octokit ready to use for GitHub Actions
 *
 * @param     token    the repo PAT or GITHUB_TOKEN
 * @param     options  other options to set
 */
function getOctokit(token, options, ...additionalPlugins) {
    const GitHubWithPlugins = utils_1.GitHub.plugin(...additionalPlugins);
    return new GitHubWithPlugins((0, utils_1.getOctokitOptions)(token, options));
}
exports.getOctokit = getOctokit;
//# sourceMappingURL=github.js.map

/***/ }),

/***/ 65156:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getApiBaseUrl = exports.getProxyFetch = exports.getProxyAgentDispatcher = exports.getProxyAgent = exports.getAuthString = void 0;
const httpClient = __importStar(__nccwpck_require__(54844));
const undici_1 = __nccwpck_require__(46752);
function getAuthString(token, options) {
    if (!token && !options.auth) {
        throw new Error('Parameter token or opts.auth is required');
    }
    else if (token && options.auth) {
        throw new Error('Parameters token and opts.auth may not both be specified');
    }
    return typeof options.auth === 'string' ? options.auth : `token ${token}`;
}
exports.getAuthString = getAuthString;
function getProxyAgent(destinationUrl) {
    const hc = new httpClient.HttpClient();
    return hc.getAgent(destinationUrl);
}
exports.getProxyAgent = getProxyAgent;
function getProxyAgentDispatcher(destinationUrl) {
    const hc = new httpClient.HttpClient();
    return hc.getAgentDispatcher(destinationUrl);
}
exports.getProxyAgentDispatcher = getProxyAgentDispatcher;
function getProxyFetch(destinationUrl) {
    const httpDispatcher = getProxyAgentDispatcher(destinationUrl);
    const proxyFetch = (url, opts) => __awaiter(this, void 0, void 0, function* () {
        return (0, undici_1.fetch)(url, Object.assign(Object.assign({}, opts), { dispatcher: httpDispatcher }));
    });
    return proxyFetch;
}
exports.getProxyFetch = getProxyFetch;
function getApiBaseUrl() {
    return process.env['GITHUB_API_URL'] || 'https://api.github.com';
}
exports.getApiBaseUrl = getApiBaseUrl;
//# sourceMappingURL=utils.js.map

/***/ }),

/***/ 38006:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getOctokitOptions = exports.GitHub = exports.defaults = exports.context = void 0;
const Context = __importStar(__nccwpck_require__(51648));
const Utils = __importStar(__nccwpck_require__(65156));
// octokit + plugins
const core_1 = __nccwpck_require__(61897);
const plugin_rest_endpoint_methods_1 = __nccwpck_require__(84935);
const plugin_paginate_rest_1 = __nccwpck_require__(38082);
exports.context = new Context.Context();
const baseUrl = Utils.getApiBaseUrl();
exports.defaults = {
    baseUrl,
    request: {
        agent: Utils.getProxyAgent(baseUrl),
        fetch: Utils.getProxyFetch(baseUrl)
    }
};
exports.GitHub = core_1.Octokit.plugin(plugin_rest_endpoint_methods_1.restEndpointMethods, plugin_paginate_rest_1.paginateRest).defaults(exports.defaults);
/**
 * Convience function to correctly format Octokit Options to pass into the constructor.
 *
 * @param     token    the repo PAT or GITHUB_TOKEN
 * @param     options  other options to set
 */
function getOctokitOptions(token, options) {
    const opts = Object.assign({}, options || {}); // Shallow clone - don't mutate the object provided by the caller
    // Auth
    const auth = Utils.getAuthString(token, opts);
    if (auth) {
        opts.auth = auth;
    }
    return opts;
}
exports.getOctokitOptions = getOctokitOptions;
//# sourceMappingURL=utils.js.map

/***/ }),

/***/ 47206:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.hashFiles = exports.create = void 0;
const internal_globber_1 = __nccwpck_require__(10103);
const internal_hash_files_1 = __nccwpck_require__(73608);
/**
 * Constructs a globber
 *
 * @param patterns  Patterns separated by newlines
 * @param options   Glob options
 */
function create(patterns, options) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield internal_globber_1.DefaultGlobber.create(patterns, options);
    });
}
exports.create = create;
/**
 * Computes the sha256 hash of a glob
 *
 * @param patterns  Patterns separated by newlines
 * @param currentWorkspace  Workspace used when matching files
 * @param options   Glob options
 * @param verbose   Enables verbose logging
 */
function hashFiles(patterns, currentWorkspace = '', options, verbose = false) {
    return __awaiter(this, void 0, void 0, function* () {
        let followSymbolicLinks = true;
        if (options && typeof options.followSymbolicLinks === 'boolean') {
            followSymbolicLinks = options.followSymbolicLinks;
        }
        const globber = yield create(patterns, { followSymbolicLinks });
        return (0, internal_hash_files_1.hashFiles)(globber, currentWorkspace, verbose);
    });
}
exports.hashFiles = hashFiles;
//# sourceMappingURL=glob.js.map

/***/ }),

/***/ 18164:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getOptions = void 0;
const core = __importStar(__nccwpck_require__(37484));
/**
 * Returns a copy with defaults filled in.
 */
function getOptions(copy) {
    const result = {
        followSymbolicLinks: true,
        implicitDescendants: true,
        matchDirectories: true,
        omitBrokenSymbolicLinks: true,
        excludeHiddenFiles: false
    };
    if (copy) {
        if (typeof copy.followSymbolicLinks === 'boolean') {
            result.followSymbolicLinks = copy.followSymbolicLinks;
            core.debug(`followSymbolicLinks '${result.followSymbolicLinks}'`);
        }
        if (typeof copy.implicitDescendants === 'boolean') {
            result.implicitDescendants = copy.implicitDescendants;
            core.debug(`implicitDescendants '${result.implicitDescendants}'`);
        }
        if (typeof copy.matchDirectories === 'boolean') {
            result.matchDirectories = copy.matchDirectories;
            core.debug(`matchDirectories '${result.matchDirectories}'`);
        }
        if (typeof copy.omitBrokenSymbolicLinks === 'boolean') {
            result.omitBrokenSymbolicLinks = copy.omitBrokenSymbolicLinks;
            core.debug(`omitBrokenSymbolicLinks '${result.omitBrokenSymbolicLinks}'`);
        }
        if (typeof copy.excludeHiddenFiles === 'boolean') {
            result.excludeHiddenFiles = copy.excludeHiddenFiles;
            core.debug(`excludeHiddenFiles '${result.excludeHiddenFiles}'`);
        }
    }
    return result;
}
exports.getOptions = getOptions;
//# sourceMappingURL=internal-glob-options-helper.js.map

/***/ }),

/***/ 10103:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DefaultGlobber = void 0;
const core = __importStar(__nccwpck_require__(37484));
const fs = __importStar(__nccwpck_require__(79896));
const globOptionsHelper = __importStar(__nccwpck_require__(18164));
const path = __importStar(__nccwpck_require__(16928));
const patternHelper = __importStar(__nccwpck_require__(98891));
const internal_match_kind_1 = __nccwpck_require__(62644);
const internal_pattern_1 = __nccwpck_require__(25370);
const internal_search_state_1 = __nccwpck_require__(79890);
const IS_WINDOWS = process.platform === 'win32';
class DefaultGlobber {
    constructor(options) {
        this.patterns = [];
        this.searchPaths = [];
        this.options = globOptionsHelper.getOptions(options);
    }
    getSearchPaths() {
        // Return a copy
        return this.searchPaths.slice();
    }
    glob() {
        var _a, e_1, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const result = [];
            try {
                for (var _d = true, _e = __asyncValues(this.globGenerator()), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const itemPath = _c;
                    result.push(itemPath);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return result;
        });
    }
    globGenerator() {
        return __asyncGenerator(this, arguments, function* globGenerator_1() {
            // Fill in defaults options
            const options = globOptionsHelper.getOptions(this.options);
            // Implicit descendants?
            const patterns = [];
            for (const pattern of this.patterns) {
                patterns.push(pattern);
                if (options.implicitDescendants &&
                    (pattern.trailingSeparator ||
                        pattern.segments[pattern.segments.length - 1] !== '**')) {
                    patterns.push(new internal_pattern_1.Pattern(pattern.negate, true, pattern.segments.concat('**')));
                }
            }
            // Push the search paths
            const stack = [];
            for (const searchPath of patternHelper.getSearchPaths(patterns)) {
                core.debug(`Search path '${searchPath}'`);
                // Exists?
                try {
                    // Intentionally using lstat. Detection for broken symlink
                    // will be performed later (if following symlinks).
                    yield __await(fs.promises.lstat(searchPath));
                }
                catch (err) {
                    if (err.code === 'ENOENT') {
                        continue;
                    }
                    throw err;
                }
                stack.unshift(new internal_search_state_1.SearchState(searchPath, 1));
            }
            // Search
            const traversalChain = []; // used to detect cycles
            while (stack.length) {
                // Pop
                const item = stack.pop();
                // Match?
                const match = patternHelper.match(patterns, item.path);
                const partialMatch = !!match || patternHelper.partialMatch(patterns, item.path);
                if (!match && !partialMatch) {
                    continue;
                }
                // Stat
                const stats = yield __await(DefaultGlobber.stat(item, options, traversalChain)
                // Broken symlink, or symlink cycle detected, or no longer exists
                );
                // Broken symlink, or symlink cycle detected, or no longer exists
                if (!stats) {
                    continue;
                }
                // Hidden file or directory?
                if (options.excludeHiddenFiles && path.basename(item.path).match(/^\./)) {
                    continue;
                }
                // Directory
                if (stats.isDirectory()) {
                    // Matched
                    if (match & internal_match_kind_1.MatchKind.Directory && options.matchDirectories) {
                        yield yield __await(item.path);
                    }
                    // Descend?
                    else if (!partialMatch) {
                        continue;
                    }
                    // Push the child items in reverse
                    const childLevel = item.level + 1;
                    const childItems = (yield __await(fs.promises.readdir(item.path))).map(x => new internal_search_state_1.SearchState(path.join(item.path, x), childLevel));
                    stack.push(...childItems.reverse());
                }
                // File
                else if (match & internal_match_kind_1.MatchKind.File) {
                    yield yield __await(item.path);
                }
            }
        });
    }
    /**
     * Constructs a DefaultGlobber
     */
    static create(patterns, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = new DefaultGlobber(options);
            if (IS_WINDOWS) {
                patterns = patterns.replace(/\r\n/g, '\n');
                patterns = patterns.replace(/\r/g, '\n');
            }
            const lines = patterns.split('\n').map(x => x.trim());
            for (const line of lines) {
                // Empty or comment
                if (!line || line.startsWith('#')) {
                    continue;
                }
                // Pattern
                else {
                    result.patterns.push(new internal_pattern_1.Pattern(line));
                }
            }
            result.searchPaths.push(...patternHelper.getSearchPaths(result.patterns));
            return result;
        });
    }
    static stat(item, options, traversalChain) {
        return __awaiter(this, void 0, void 0, function* () {
            // Note:
            // `stat` returns info about the target of a symlink (or symlink chain)
            // `lstat` returns info about a symlink itself
            let stats;
            if (options.followSymbolicLinks) {
                try {
                    // Use `stat` (following symlinks)
                    stats = yield fs.promises.stat(item.path);
                }
                catch (err) {
                    if (err.code === 'ENOENT') {
                        if (options.omitBrokenSymbolicLinks) {
                            core.debug(`Broken symlink '${item.path}'`);
                            return undefined;
                        }
                        throw new Error(`No information found for the path '${item.path}'. This may indicate a broken symbolic link.`);
                    }
                    throw err;
                }
            }
            else {
                // Use `lstat` (not following symlinks)
                stats = yield fs.promises.lstat(item.path);
            }
            // Note, isDirectory() returns false for the lstat of a symlink
            if (stats.isDirectory() && options.followSymbolicLinks) {
                // Get the realpath
                const realPath = yield fs.promises.realpath(item.path);
                // Fixup the traversal chain to match the item level
                while (traversalChain.length >= item.level) {
                    traversalChain.pop();
                }
                // Test for a cycle
                if (traversalChain.some((x) => x === realPath)) {
                    core.debug(`Symlink cycle detected for path '${item.path}' and realpath '${realPath}'`);
                    return undefined;
                }
                // Update the traversal chain
                traversalChain.push(realPath);
            }
            return stats;
        });
    }
}
exports.DefaultGlobber = DefaultGlobber;
//# sourceMappingURL=internal-globber.js.map

/***/ }),

/***/ 73608:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.hashFiles = void 0;
const crypto = __importStar(__nccwpck_require__(76982));
const core = __importStar(__nccwpck_require__(37484));
const fs = __importStar(__nccwpck_require__(79896));
const stream = __importStar(__nccwpck_require__(2203));
const util = __importStar(__nccwpck_require__(39023));
const path = __importStar(__nccwpck_require__(16928));
function hashFiles(globber, currentWorkspace, verbose = false) {
    var _a, e_1, _b, _c;
    var _d;
    return __awaiter(this, void 0, void 0, function* () {
        const writeDelegate = verbose ? core.info : core.debug;
        let hasMatch = false;
        const githubWorkspace = currentWorkspace
            ? currentWorkspace
            : (_d = process.env['GITHUB_WORKSPACE']) !== null && _d !== void 0 ? _d : process.cwd();
        const result = crypto.createHash('sha256');
        let count = 0;
        try {
            for (var _e = true, _f = __asyncValues(globber.globGenerator()), _g; _g = yield _f.next(), _a = _g.done, !_a; _e = true) {
                _c = _g.value;
                _e = false;
                const file = _c;
                writeDelegate(file);
                if (!file.startsWith(`${githubWorkspace}${path.sep}`)) {
                    writeDelegate(`Ignore '${file}' since it is not under GITHUB_WORKSPACE.`);
                    continue;
                }
                if (fs.statSync(file).isDirectory()) {
                    writeDelegate(`Skip directory '${file}'.`);
                    continue;
                }
                const hash = crypto.createHash('sha256');
                const pipeline = util.promisify(stream.pipeline);
                yield pipeline(fs.createReadStream(file), hash);
                result.write(hash.digest());
                count++;
                if (!hasMatch) {
                    hasMatch = true;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_e && !_a && (_b = _f.return)) yield _b.call(_f);
            }
            finally { if (e_1) throw e_1.error; }
        }
        result.end();
        if (hasMatch) {
            writeDelegate(`Found ${count} files to hash.`);
            return result.digest('hex');
        }
        else {
            writeDelegate(`No matches found for glob`);
            return '';
        }
    });
}
exports.hashFiles = hashFiles;
//# sourceMappingURL=internal-hash-files.js.map

/***/ }),

/***/ 62644:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MatchKind = void 0;
/**
 * Indicates whether a pattern matches a path
 */
var MatchKind;
(function (MatchKind) {
    /** Not matched */
    MatchKind[MatchKind["None"] = 0] = "None";
    /** Matched if the path is a directory */
    MatchKind[MatchKind["Directory"] = 1] = "Directory";
    /** Matched if the path is a regular file */
    MatchKind[MatchKind["File"] = 2] = "File";
    /** Matched */
    MatchKind[MatchKind["All"] = 3] = "All";
})(MatchKind || (exports.MatchKind = MatchKind = {}));
//# sourceMappingURL=internal-match-kind.js.map

/***/ }),

/***/ 84138:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.safeTrimTrailingSeparator = exports.normalizeSeparators = exports.hasRoot = exports.hasAbsoluteRoot = exports.ensureAbsoluteRoot = exports.dirname = void 0;
const path = __importStar(__nccwpck_require__(16928));
const assert_1 = __importDefault(__nccwpck_require__(42613));
const IS_WINDOWS = process.platform === 'win32';
/**
 * Similar to path.dirname except normalizes the path separators and slightly better handling for Windows UNC paths.
 *
 * For example, on Linux/macOS:
 * - `/               => /`
 * - `/hello          => /`
 *
 * For example, on Windows:
 * - `C:\             => C:\`
 * - `C:\hello        => C:\`
 * - `C:              => C:`
 * - `C:hello         => C:`
 * - `\               => \`
 * - `\hello          => \`
 * - `\\hello         => \\hello`
 * - `\\hello\world   => \\hello\world`
 */
function dirname(p) {
    // Normalize slashes and trim unnecessary trailing slash
    p = safeTrimTrailingSeparator(p);
    // Windows UNC root, e.g. \\hello or \\hello\world
    if (IS_WINDOWS && /^\\\\[^\\]+(\\[^\\]+)?$/.test(p)) {
        return p;
    }
    // Get dirname
    let result = path.dirname(p);
    // Trim trailing slash for Windows UNC root, e.g. \\hello\world\
    if (IS_WINDOWS && /^\\\\[^\\]+\\[^\\]+\\$/.test(result)) {
        result = safeTrimTrailingSeparator(result);
    }
    return result;
}
exports.dirname = dirname;
/**
 * Roots the path if not already rooted. On Windows, relative roots like `\`
 * or `C:` are expanded based on the current working directory.
 */
function ensureAbsoluteRoot(root, itemPath) {
    (0, assert_1.default)(root, `ensureAbsoluteRoot parameter 'root' must not be empty`);
    (0, assert_1.default)(itemPath, `ensureAbsoluteRoot parameter 'itemPath' must not be empty`);
    // Already rooted
    if (hasAbsoluteRoot(itemPath)) {
        return itemPath;
    }
    // Windows
    if (IS_WINDOWS) {
        // Check for itemPath like C: or C:foo
        if (itemPath.match(/^[A-Z]:[^\\/]|^[A-Z]:$/i)) {
            let cwd = process.cwd();
            (0, assert_1.default)(cwd.match(/^[A-Z]:\\/i), `Expected current directory to start with an absolute drive root. Actual '${cwd}'`);
            // Drive letter matches cwd? Expand to cwd
            if (itemPath[0].toUpperCase() === cwd[0].toUpperCase()) {
                // Drive only, e.g. C:
                if (itemPath.length === 2) {
                    // Preserve specified drive letter case (upper or lower)
                    return `${itemPath[0]}:\\${cwd.substr(3)}`;
                }
                // Drive + path, e.g. C:foo
                else {
                    if (!cwd.endsWith('\\')) {
                        cwd += '\\';
                    }
                    // Preserve specified drive letter case (upper or lower)
                    return `${itemPath[0]}:\\${cwd.substr(3)}${itemPath.substr(2)}`;
                }
            }
            // Different drive
            else {
                return `${itemPath[0]}:\\${itemPath.substr(2)}`;
            }
        }
        // Check for itemPath like \ or \foo
        else if (normalizeSeparators(itemPath).match(/^\\$|^\\[^\\]/)) {
            const cwd = process.cwd();
            (0, assert_1.default)(cwd.match(/^[A-Z]:\\/i), `Expected current directory to start with an absolute drive root. Actual '${cwd}'`);
            return `${cwd[0]}:\\${itemPath.substr(1)}`;
        }
    }
    (0, assert_1.default)(hasAbsoluteRoot(root), `ensureAbsoluteRoot parameter 'root' must have an absolute root`);
    // Otherwise ensure root ends with a separator
    if (root.endsWith('/') || (IS_WINDOWS && root.endsWith('\\'))) {
        // Intentionally empty
    }
    else {
        // Append separator
        root += path.sep;
    }
    return root + itemPath;
}
exports.ensureAbsoluteRoot = ensureAbsoluteRoot;
/**
 * On Linux/macOS, true if path starts with `/`. On Windows, true for paths like:
 * `\\hello\share` and `C:\hello` (and using alternate separator).
 */
function hasAbsoluteRoot(itemPath) {
    (0, assert_1.default)(itemPath, `hasAbsoluteRoot parameter 'itemPath' must not be empty`);
    // Normalize separators
    itemPath = normalizeSeparators(itemPath);
    // Windows
    if (IS_WINDOWS) {
        // E.g. \\hello\share or C:\hello
        return itemPath.startsWith('\\\\') || /^[A-Z]:\\/i.test(itemPath);
    }
    // E.g. /hello
    return itemPath.startsWith('/');
}
exports.hasAbsoluteRoot = hasAbsoluteRoot;
/**
 * On Linux/macOS, true if path starts with `/`. On Windows, true for paths like:
 * `\`, `\hello`, `\\hello\share`, `C:`, and `C:\hello` (and using alternate separator).
 */
function hasRoot(itemPath) {
    (0, assert_1.default)(itemPath, `isRooted parameter 'itemPath' must not be empty`);
    // Normalize separators
    itemPath = normalizeSeparators(itemPath);
    // Windows
    if (IS_WINDOWS) {
        // E.g. \ or \hello or \\hello
        // E.g. C: or C:\hello
        return itemPath.startsWith('\\') || /^[A-Z]:/i.test(itemPath);
    }
    // E.g. /hello
    return itemPath.startsWith('/');
}
exports.hasRoot = hasRoot;
/**
 * Removes redundant slashes and converts `/` to `\` on Windows
 */
function normalizeSeparators(p) {
    p = p || '';
    // Windows
    if (IS_WINDOWS) {
        // Convert slashes on Windows
        p = p.replace(/\//g, '\\');
        // Remove redundant slashes
        const isUnc = /^\\\\+[^\\]/.test(p); // e.g. \\hello
        return (isUnc ? '\\' : '') + p.replace(/\\\\+/g, '\\'); // preserve leading \\ for UNC
    }
    // Remove redundant slashes
    return p.replace(/\/\/+/g, '/');
}
exports.normalizeSeparators = normalizeSeparators;
/**
 * Normalizes the path separators and trims the trailing separator (when safe).
 * For example, `/foo/ => /foo` but `/ => /`
 */
function safeTrimTrailingSeparator(p) {
    // Short-circuit if empty
    if (!p) {
        return '';
    }
    // Normalize separators
    p = normalizeSeparators(p);
    // No trailing slash
    if (!p.endsWith(path.sep)) {
        return p;
    }
    // Check '/' on Linux/macOS and '\' on Windows
    if (p === path.sep) {
        return p;
    }
    // On Windows check if drive root. E.g. C:\
    if (IS_WINDOWS && /^[A-Z]:\\$/i.test(p)) {
        return p;
    }
    // Otherwise trim trailing slash
    return p.substr(0, p.length - 1);
}
exports.safeTrimTrailingSeparator = safeTrimTrailingSeparator;
//# sourceMappingURL=internal-path-helper.js.map

/***/ }),

/***/ 76617:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Path = void 0;
const path = __importStar(__nccwpck_require__(16928));
const pathHelper = __importStar(__nccwpck_require__(84138));
const assert_1 = __importDefault(__nccwpck_require__(42613));
const IS_WINDOWS = process.platform === 'win32';
/**
 * Helper class for parsing paths into segments
 */
class Path {
    /**
     * Constructs a Path
     * @param itemPath Path or array of segments
     */
    constructor(itemPath) {
        this.segments = [];
        // String
        if (typeof itemPath === 'string') {
            (0, assert_1.default)(itemPath, `Parameter 'itemPath' must not be empty`);
            // Normalize slashes and trim unnecessary trailing slash
            itemPath = pathHelper.safeTrimTrailingSeparator(itemPath);
            // Not rooted
            if (!pathHelper.hasRoot(itemPath)) {
                this.segments = itemPath.split(path.sep);
            }
            // Rooted
            else {
                // Add all segments, while not at the root
                let remaining = itemPath;
                let dir = pathHelper.dirname(remaining);
                while (dir !== remaining) {
                    // Add the segment
                    const basename = path.basename(remaining);
                    this.segments.unshift(basename);
                    // Truncate the last segment
                    remaining = dir;
                    dir = pathHelper.dirname(remaining);
                }
                // Remainder is the root
                this.segments.unshift(remaining);
            }
        }
        // Array
        else {
            // Must not be empty
            (0, assert_1.default)(itemPath.length > 0, `Parameter 'itemPath' must not be an empty array`);
            // Each segment
            for (let i = 0; i < itemPath.length; i++) {
                let segment = itemPath[i];
                // Must not be empty
                (0, assert_1.default)(segment, `Parameter 'itemPath' must not contain any empty segments`);
                // Normalize slashes
                segment = pathHelper.normalizeSeparators(itemPath[i]);
                // Root segment
                if (i === 0 && pathHelper.hasRoot(segment)) {
                    segment = pathHelper.safeTrimTrailingSeparator(segment);
                    (0, assert_1.default)(segment === pathHelper.dirname(segment), `Parameter 'itemPath' root segment contains information for multiple segments`);
                    this.segments.push(segment);
                }
                // All other segments
                else {
                    // Must not contain slash
                    (0, assert_1.default)(!segment.includes(path.sep), `Parameter 'itemPath' contains unexpected path separators`);
                    this.segments.push(segment);
                }
            }
        }
    }
    /**
     * Converts the path to it's string representation
     */
    toString() {
        // First segment
        let result = this.segments[0];
        // All others
        let skipSlash = result.endsWith(path.sep) || (IS_WINDOWS && /^[A-Z]:$/i.test(result));
        for (let i = 1; i < this.segments.length; i++) {
            if (skipSlash) {
                skipSlash = false;
            }
            else {
                result += path.sep;
            }
            result += this.segments[i];
        }
        return result;
    }
}
exports.Path = Path;
//# sourceMappingURL=internal-path.js.map

/***/ }),

/***/ 98891:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.partialMatch = exports.match = exports.getSearchPaths = void 0;
const pathHelper = __importStar(__nccwpck_require__(84138));
const internal_match_kind_1 = __nccwpck_require__(62644);
const IS_WINDOWS = process.platform === 'win32';
/**
 * Given an array of patterns, returns an array of paths to search.
 * Duplicates and paths under other included paths are filtered out.
 */
function getSearchPaths(patterns) {
    // Ignore negate patterns
    patterns = patterns.filter(x => !x.negate);
    // Create a map of all search paths
    const searchPathMap = {};
    for (const pattern of patterns) {
        const key = IS_WINDOWS
            ? pattern.searchPath.toUpperCase()
            : pattern.searchPath;
        searchPathMap[key] = 'candidate';
    }
    const result = [];
    for (const pattern of patterns) {
        // Check if already included
        const key = IS_WINDOWS
            ? pattern.searchPath.toUpperCase()
            : pattern.searchPath;
        if (searchPathMap[key] === 'included') {
            continue;
        }
        // Check for an ancestor search path
        let foundAncestor = false;
        let tempKey = key;
        let parent = pathHelper.dirname(tempKey);
        while (parent !== tempKey) {
            if (searchPathMap[parent]) {
                foundAncestor = true;
                break;
            }
            tempKey = parent;
            parent = pathHelper.dirname(tempKey);
        }
        // Include the search pattern in the result
        if (!foundAncestor) {
            result.push(pattern.searchPath);
            searchPathMap[key] = 'included';
        }
    }
    return result;
}
exports.getSearchPaths = getSearchPaths;
/**
 * Matches the patterns against the path
 */
function match(patterns, itemPath) {
    let result = internal_match_kind_1.MatchKind.None;
    for (const pattern of patterns) {
        if (pattern.negate) {
            result &= ~pattern.match(itemPath);
        }
        else {
            result |= pattern.match(itemPath);
        }
    }
    return result;
}
exports.match = match;
/**
 * Checks whether to descend further into the directory
 */
function partialMatch(patterns, itemPath) {
    return patterns.some(x => !x.negate && x.partialMatch(itemPath));
}
exports.partialMatch = partialMatch;
//# sourceMappingURL=internal-pattern-helper.js.map

/***/ }),

/***/ 25370:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Pattern = void 0;
const os = __importStar(__nccwpck_require__(70857));
const path = __importStar(__nccwpck_require__(16928));
const pathHelper = __importStar(__nccwpck_require__(84138));
const assert_1 = __importDefault(__nccwpck_require__(42613));
const minimatch_1 = __nccwpck_require__(43772);
const internal_match_kind_1 = __nccwpck_require__(62644);
const internal_path_1 = __nccwpck_require__(76617);
const IS_WINDOWS = process.platform === 'win32';
class Pattern {
    constructor(patternOrNegate, isImplicitPattern = false, segments, homedir) {
        /**
         * Indicates whether matches should be excluded from the result set
         */
        this.negate = false;
        // Pattern overload
        let pattern;
        if (typeof patternOrNegate === 'string') {
            pattern = patternOrNegate.trim();
        }
        // Segments overload
        else {
            // Convert to pattern
            segments = segments || [];
            (0, assert_1.default)(segments.length, `Parameter 'segments' must not empty`);
            const root = Pattern.getLiteral(segments[0]);
            (0, assert_1.default)(root && pathHelper.hasAbsoluteRoot(root), `Parameter 'segments' first element must be a root path`);
            pattern = new internal_path_1.Path(segments).toString().trim();
            if (patternOrNegate) {
                pattern = `!${pattern}`;
            }
        }
        // Negate
        while (pattern.startsWith('!')) {
            this.negate = !this.negate;
            pattern = pattern.substr(1).trim();
        }
        // Normalize slashes and ensures absolute root
        pattern = Pattern.fixupPattern(pattern, homedir);
        // Segments
        this.segments = new internal_path_1.Path(pattern).segments;
        // Trailing slash indicates the pattern should only match directories, not regular files
        this.trailingSeparator = pathHelper
            .normalizeSeparators(pattern)
            .endsWith(path.sep);
        pattern = pathHelper.safeTrimTrailingSeparator(pattern);
        // Search path (literal path prior to the first glob segment)
        let foundGlob = false;
        const searchSegments = this.segments
            .map(x => Pattern.getLiteral(x))
            .filter(x => !foundGlob && !(foundGlob = x === ''));
        this.searchPath = new internal_path_1.Path(searchSegments).toString();
        // Root RegExp (required when determining partial match)
        this.rootRegExp = new RegExp(Pattern.regExpEscape(searchSegments[0]), IS_WINDOWS ? 'i' : '');
        this.isImplicitPattern = isImplicitPattern;
        // Create minimatch
        const minimatchOptions = {
            dot: true,
            nobrace: true,
            nocase: IS_WINDOWS,
            nocomment: true,
            noext: true,
            nonegate: true
        };
        pattern = IS_WINDOWS ? pattern.replace(/\\/g, '/') : pattern;
        this.minimatch = new minimatch_1.Minimatch(pattern, minimatchOptions);
    }
    /**
     * Matches the pattern against the specified path
     */
    match(itemPath) {
        // Last segment is globstar?
        if (this.segments[this.segments.length - 1] === '**') {
            // Normalize slashes
            itemPath = pathHelper.normalizeSeparators(itemPath);
            // Append a trailing slash. Otherwise Minimatch will not match the directory immediately
            // preceding the globstar. For example, given the pattern `/foo/**`, Minimatch returns
            // false for `/foo` but returns true for `/foo/`. Append a trailing slash to handle that quirk.
            if (!itemPath.endsWith(path.sep) && this.isImplicitPattern === false) {
                // Note, this is safe because the constructor ensures the pattern has an absolute root.
                // For example, formats like C: and C:foo on Windows are resolved to an absolute root.
                itemPath = `${itemPath}${path.sep}`;
            }
        }
        else {
            // Normalize slashes and trim unnecessary trailing slash
            itemPath = pathHelper.safeTrimTrailingSeparator(itemPath);
        }
        // Match
        if (this.minimatch.match(itemPath)) {
            return this.trailingSeparator ? internal_match_kind_1.MatchKind.Directory : internal_match_kind_1.MatchKind.All;
        }
        return internal_match_kind_1.MatchKind.None;
    }
    /**
     * Indicates whether the pattern may match descendants of the specified path
     */
    partialMatch(itemPath) {
        // Normalize slashes and trim unnecessary trailing slash
        itemPath = pathHelper.safeTrimTrailingSeparator(itemPath);
        // matchOne does not handle root path correctly
        if (pathHelper.dirname(itemPath) === itemPath) {
            return this.rootRegExp.test(itemPath);
        }
        return this.minimatch.matchOne(itemPath.split(IS_WINDOWS ? /\\+/ : /\/+/), this.minimatch.set[0], true);
    }
    /**
     * Escapes glob patterns within a path
     */
    static globEscape(s) {
        return (IS_WINDOWS ? s : s.replace(/\\/g, '\\\\')) // escape '\' on Linux/macOS
            .replace(/(\[)(?=[^/]+\])/g, '[[]') // escape '[' when ']' follows within the path segment
            .replace(/\?/g, '[?]') // escape '?'
            .replace(/\*/g, '[*]'); // escape '*'
    }
    /**
     * Normalizes slashes and ensures absolute root
     */
    static fixupPattern(pattern, homedir) {
        // Empty
        (0, assert_1.default)(pattern, 'pattern cannot be empty');
        // Must not contain `.` segment, unless first segment
        // Must not contain `..` segment
        const literalSegments = new internal_path_1.Path(pattern).segments.map(x => Pattern.getLiteral(x));
        (0, assert_1.default)(literalSegments.every((x, i) => (x !== '.' || i === 0) && x !== '..'), `Invalid pattern '${pattern}'. Relative pathing '.' and '..' is not allowed.`);
        // Must not contain globs in root, e.g. Windows UNC path \\foo\b*r
        (0, assert_1.default)(!pathHelper.hasRoot(pattern) || literalSegments[0], `Invalid pattern '${pattern}'. Root segment must not contain globs.`);
        // Normalize slashes
        pattern = pathHelper.normalizeSeparators(pattern);
        // Replace leading `.` segment
        if (pattern === '.' || pattern.startsWith(`.${path.sep}`)) {
            pattern = Pattern.globEscape(process.cwd()) + pattern.substr(1);
        }
        // Replace leading `~` segment
        else if (pattern === '~' || pattern.startsWith(`~${path.sep}`)) {
            homedir = homedir || os.homedir();
            (0, assert_1.default)(homedir, 'Unable to determine HOME directory');
            (0, assert_1.default)(pathHelper.hasAbsoluteRoot(homedir), `Expected HOME directory to be a rooted path. Actual '${homedir}'`);
            pattern = Pattern.globEscape(homedir) + pattern.substr(1);
        }
        // Replace relative drive root, e.g. pattern is C: or C:foo
        else if (IS_WINDOWS &&
            (pattern.match(/^[A-Z]:$/i) || pattern.match(/^[A-Z]:[^\\]/i))) {
            let root = pathHelper.ensureAbsoluteRoot('C:\\dummy-root', pattern.substr(0, 2));
            if (pattern.length > 2 && !root.endsWith('\\')) {
                root += '\\';
            }
            pattern = Pattern.globEscape(root) + pattern.substr(2);
        }
        // Replace relative root, e.g. pattern is \ or \foo
        else if (IS_WINDOWS && (pattern === '\\' || pattern.match(/^\\[^\\]/))) {
            let root = pathHelper.ensureAbsoluteRoot('C:\\dummy-root', '\\');
            if (!root.endsWith('\\')) {
                root += '\\';
            }
            pattern = Pattern.globEscape(root) + pattern.substr(1);
        }
        // Otherwise ensure absolute root
        else {
            pattern = pathHelper.ensureAbsoluteRoot(Pattern.globEscape(process.cwd()), pattern);
        }
        return pathHelper.normalizeSeparators(pattern);
    }
    /**
     * Attempts to unescape a pattern segment to create a literal path segment.
     * Otherwise returns empty string.
     */
    static getLiteral(segment) {
        let literal = '';
        for (let i = 0; i < segment.length; i++) {
            const c = segment[i];
            // Escape
            if (c === '\\' && !IS_WINDOWS && i + 1 < segment.length) {
                literal += segment[++i];
                continue;
            }
            // Wildcard
            else if (c === '*' || c === '?') {
                return '';
            }
            // Character set
            else if (c === '[' && i + 1 < segment.length) {
                let set = '';
                let closed = -1;
                for (let i2 = i + 1; i2 < segment.length; i2++) {
                    const c2 = segment[i2];
                    // Escape
                    if (c2 === '\\' && !IS_WINDOWS && i2 + 1 < segment.length) {
                        set += segment[++i2];
                        continue;
                    }
                    // Closed
                    else if (c2 === ']') {
                        closed = i2;
                        break;
                    }
                    // Otherwise
                    else {
                        set += c2;
                    }
                }
                // Closed?
                if (closed >= 0) {
                    // Cannot convert
                    if (set.length > 1) {
                        return '';
                    }
                    // Convert to literal
                    if (set) {
                        literal += set;
                        i = closed;
                        continue;
                    }
                }
                // Otherwise fall thru
            }
            // Append
            literal += c;
        }
        return literal;
    }
    /**
     * Escapes regexp special characters
     * https://javascript.info/regexp-escaping
     */
    static regExpEscape(s) {
        return s.replace(/[[\\^$.|?*+()]/g, '\\$&');
    }
}
exports.Pattern = Pattern;
//# sourceMappingURL=internal-pattern.js.map

/***/ }),

/***/ 79890:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SearchState = void 0;
class SearchState {
    constructor(path, level) {
        this.path = path;
        this.level = level;
    }
}
exports.SearchState = SearchState;
//# sourceMappingURL=internal-search-state.js.map

/***/ }),

/***/ 44552:
/***/ (function(__unused_webpack_module, exports) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PersonalAccessTokenCredentialHandler = exports.BearerCredentialHandler = exports.BasicCredentialHandler = void 0;
class BasicCredentialHandler {
    constructor(username, password) {
        this.username = username;
        this.password = password;
    }
    prepareRequest(options) {
        if (!options.headers) {
            throw Error('The request has no headers');
        }
        options.headers['Authorization'] = `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
    }
    // This handler cannot handle 401
    canHandleAuthentication() {
        return false;
    }
    handleAuthentication() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('not implemented');
        });
    }
}
exports.BasicCredentialHandler = BasicCredentialHandler;
class BearerCredentialHandler {
    constructor(token) {
        this.token = token;
    }
    // currently implements pre-authorization
    // TODO: support preAuth = false where it hooks on 401
    prepareRequest(options) {
        if (!options.headers) {
            throw Error('The request has no headers');
        }
        options.headers['Authorization'] = `Bearer ${this.token}`;
    }
    // This handler cannot handle 401
    canHandleAuthentication() {
        return false;
    }
    handleAuthentication() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('not implemented');
        });
    }
}
exports.BearerCredentialHandler = BearerCredentialHandler;
class PersonalAccessTokenCredentialHandler {
    constructor(token) {
        this.token = token;
    }
    // currently implements pre-authorization
    // TODO: support preAuth = false where it hooks on 401
    prepareRequest(options) {
        if (!options.headers) {
            throw Error('The request has no headers');
        }
        options.headers['Authorization'] = `Basic ${Buffer.from(`PAT:${this.token}`).toString('base64')}`;
    }
    // This handler cannot handle 401
    canHandleAuthentication() {
        return false;
    }
    handleAuthentication() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('not implemented');
        });
    }
}
exports.PersonalAccessTokenCredentialHandler = PersonalAccessTokenCredentialHandler;
//# sourceMappingURL=auth.js.map

/***/ }),

/***/ 54844:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

/* eslint-disable @typescript-eslint/no-explicit-any */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HttpClient = exports.isHttps = exports.HttpClientResponse = exports.HttpClientError = exports.getProxyUrl = exports.MediaTypes = exports.Headers = exports.HttpCodes = void 0;
const http = __importStar(__nccwpck_require__(58611));
const https = __importStar(__nccwpck_require__(65692));
const pm = __importStar(__nccwpck_require__(54988));
const tunnel = __importStar(__nccwpck_require__(20770));
const undici_1 = __nccwpck_require__(46752);
var HttpCodes;
(function (HttpCodes) {
    HttpCodes[HttpCodes["OK"] = 200] = "OK";
    HttpCodes[HttpCodes["MultipleChoices"] = 300] = "MultipleChoices";
    HttpCodes[HttpCodes["MovedPermanently"] = 301] = "MovedPermanently";
    HttpCodes[HttpCodes["ResourceMoved"] = 302] = "ResourceMoved";
    HttpCodes[HttpCodes["SeeOther"] = 303] = "SeeOther";
    HttpCodes[HttpCodes["NotModified"] = 304] = "NotModified";
    HttpCodes[HttpCodes["UseProxy"] = 305] = "UseProxy";
    HttpCodes[HttpCodes["SwitchProxy"] = 306] = "SwitchProxy";
    HttpCodes[HttpCodes["TemporaryRedirect"] = 307] = "TemporaryRedirect";
    HttpCodes[HttpCodes["PermanentRedirect"] = 308] = "PermanentRedirect";
    HttpCodes[HttpCodes["BadRequest"] = 400] = "BadRequest";
    HttpCodes[HttpCodes["Unauthorized"] = 401] = "Unauthorized";
    HttpCodes[HttpCodes["PaymentRequired"] = 402] = "PaymentRequired";
    HttpCodes[HttpCodes["Forbidden"] = 403] = "Forbidden";
    HttpCodes[HttpCodes["NotFound"] = 404] = "NotFound";
    HttpCodes[HttpCodes["MethodNotAllowed"] = 405] = "MethodNotAllowed";
    HttpCodes[HttpCodes["NotAcceptable"] = 406] = "NotAcceptable";
    HttpCodes[HttpCodes["ProxyAuthenticationRequired"] = 407] = "ProxyAuthenticationRequired";
    HttpCodes[HttpCodes["RequestTimeout"] = 408] = "RequestTimeout";
    HttpCodes[HttpCodes["Conflict"] = 409] = "Conflict";
    HttpCodes[HttpCodes["Gone"] = 410] = "Gone";
    HttpCodes[HttpCodes["TooManyRequests"] = 429] = "TooManyRequests";
    HttpCodes[HttpCodes["InternalServerError"] = 500] = "InternalServerError";
    HttpCodes[HttpCodes["NotImplemented"] = 501] = "NotImplemented";
    HttpCodes[HttpCodes["BadGateway"] = 502] = "BadGateway";
    HttpCodes[HttpCodes["ServiceUnavailable"] = 503] = "ServiceUnavailable";
    HttpCodes[HttpCodes["GatewayTimeout"] = 504] = "GatewayTimeout";
})(HttpCodes || (exports.HttpCodes = HttpCodes = {}));
var Headers;
(function (Headers) {
    Headers["Accept"] = "accept";
    Headers["ContentType"] = "content-type";
})(Headers || (exports.Headers = Headers = {}));
var MediaTypes;
(function (MediaTypes) {
    MediaTypes["ApplicationJson"] = "application/json";
})(MediaTypes || (exports.MediaTypes = MediaTypes = {}));
/**
 * Returns the proxy URL, depending upon the supplied url and proxy environment variables.
 * @param serverUrl  The server URL where the request will be sent. For example, https://api.github.com
 */
function getProxyUrl(serverUrl) {
    const proxyUrl = pm.getProxyUrl(new URL(serverUrl));
    return proxyUrl ? proxyUrl.href : '';
}
exports.getProxyUrl = getProxyUrl;
const HttpRedirectCodes = [
    HttpCodes.MovedPermanently,
    HttpCodes.ResourceMoved,
    HttpCodes.SeeOther,
    HttpCodes.TemporaryRedirect,
    HttpCodes.PermanentRedirect
];
const HttpResponseRetryCodes = [
    HttpCodes.BadGateway,
    HttpCodes.ServiceUnavailable,
    HttpCodes.GatewayTimeout
];
const RetryableHttpVerbs = ['OPTIONS', 'GET', 'DELETE', 'HEAD'];
const ExponentialBackoffCeiling = 10;
const ExponentialBackoffTimeSlice = 5;
class HttpClientError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = 'HttpClientError';
        this.statusCode = statusCode;
        Object.setPrototypeOf(this, HttpClientError.prototype);
    }
}
exports.HttpClientError = HttpClientError;
class HttpClientResponse {
    constructor(message) {
        this.message = message;
    }
    readBody() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                let output = Buffer.alloc(0);
                this.message.on('data', (chunk) => {
                    output = Buffer.concat([output, chunk]);
                });
                this.message.on('end', () => {
                    resolve(output.toString());
                });
            }));
        });
    }
    readBodyBuffer() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                const chunks = [];
                this.message.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                this.message.on('end', () => {
                    resolve(Buffer.concat(chunks));
                });
            }));
        });
    }
}
exports.HttpClientResponse = HttpClientResponse;
function isHttps(requestUrl) {
    const parsedUrl = new URL(requestUrl);
    return parsedUrl.protocol === 'https:';
}
exports.isHttps = isHttps;
class HttpClient {
    constructor(userAgent, handlers, requestOptions) {
        this._ignoreSslError = false;
        this._allowRedirects = true;
        this._allowRedirectDowngrade = false;
        this._maxRedirects = 50;
        this._allowRetries = false;
        this._maxRetries = 1;
        this._keepAlive = false;
        this._disposed = false;
        this.userAgent = userAgent;
        this.handlers = handlers || [];
        this.requestOptions = requestOptions;
        if (requestOptions) {
            if (requestOptions.ignoreSslError != null) {
                this._ignoreSslError = requestOptions.ignoreSslError;
            }
            this._socketTimeout = requestOptions.socketTimeout;
            if (requestOptions.allowRedirects != null) {
                this._allowRedirects = requestOptions.allowRedirects;
            }
            if (requestOptions.allowRedirectDowngrade != null) {
                this._allowRedirectDowngrade = requestOptions.allowRedirectDowngrade;
            }
            if (requestOptions.maxRedirects != null) {
                this._maxRedirects = Math.max(requestOptions.maxRedirects, 0);
            }
            if (requestOptions.keepAlive != null) {
                this._keepAlive = requestOptions.keepAlive;
            }
            if (requestOptions.allowRetries != null) {
                this._allowRetries = requestOptions.allowRetries;
            }
            if (requestOptions.maxRetries != null) {
                this._maxRetries = requestOptions.maxRetries;
            }
        }
    }
    options(requestUrl, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request('OPTIONS', requestUrl, null, additionalHeaders || {});
        });
    }
    get(requestUrl, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request('GET', requestUrl, null, additionalHeaders || {});
        });
    }
    del(requestUrl, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request('DELETE', requestUrl, null, additionalHeaders || {});
        });
    }
    post(requestUrl, data, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request('POST', requestUrl, data, additionalHeaders || {});
        });
    }
    patch(requestUrl, data, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request('PATCH', requestUrl, data, additionalHeaders || {});
        });
    }
    put(requestUrl, data, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request('PUT', requestUrl, data, additionalHeaders || {});
        });
    }
    head(requestUrl, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request('HEAD', requestUrl, null, additionalHeaders || {});
        });
    }
    sendStream(verb, requestUrl, stream, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request(verb, requestUrl, stream, additionalHeaders);
        });
    }
    /**
     * Gets a typed object from an endpoint
     * Be aware that not found returns a null.  Other errors (4xx, 5xx) reject the promise
     */
    getJson(requestUrl, additionalHeaders = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            additionalHeaders[Headers.Accept] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.Accept, MediaTypes.ApplicationJson);
            const res = yield this.get(requestUrl, additionalHeaders);
            return this._processResponse(res, this.requestOptions);
        });
    }
    postJson(requestUrl, obj, additionalHeaders = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = JSON.stringify(obj, null, 2);
            additionalHeaders[Headers.Accept] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.Accept, MediaTypes.ApplicationJson);
            additionalHeaders[Headers.ContentType] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.ContentType, MediaTypes.ApplicationJson);
            const res = yield this.post(requestUrl, data, additionalHeaders);
            return this._processResponse(res, this.requestOptions);
        });
    }
    putJson(requestUrl, obj, additionalHeaders = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = JSON.stringify(obj, null, 2);
            additionalHeaders[Headers.Accept] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.Accept, MediaTypes.ApplicationJson);
            additionalHeaders[Headers.ContentType] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.ContentType, MediaTypes.ApplicationJson);
            const res = yield this.put(requestUrl, data, additionalHeaders);
            return this._processResponse(res, this.requestOptions);
        });
    }
    patchJson(requestUrl, obj, additionalHeaders = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = JSON.stringify(obj, null, 2);
            additionalHeaders[Headers.Accept] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.Accept, MediaTypes.ApplicationJson);
            additionalHeaders[Headers.ContentType] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.ContentType, MediaTypes.ApplicationJson);
            const res = yield this.patch(requestUrl, data, additionalHeaders);
            return this._processResponse(res, this.requestOptions);
        });
    }
    /**
     * Makes a raw http request.
     * All other methods such as get, post, patch, and request ultimately call this.
     * Prefer get, del, post and patch
     */
    request(verb, requestUrl, data, headers) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._disposed) {
                throw new Error('Client has already been disposed.');
            }
            const parsedUrl = new URL(requestUrl);
            let info = this._prepareRequest(verb, parsedUrl, headers);
            // Only perform retries on reads since writes may not be idempotent.
            const maxTries = this._allowRetries && RetryableHttpVerbs.includes(verb)
                ? this._maxRetries + 1
                : 1;
            let numTries = 0;
            let response;
            do {
                response = yield this.requestRaw(info, data);
                // Check if it's an authentication challenge
                if (response &&
                    response.message &&
                    response.message.statusCode === HttpCodes.Unauthorized) {
                    let authenticationHandler;
                    for (const handler of this.handlers) {
                        if (handler.canHandleAuthentication(response)) {
                            authenticationHandler = handler;
                            break;
                        }
                    }
                    if (authenticationHandler) {
                        return authenticationHandler.handleAuthentication(this, info, data);
                    }
                    else {
                        // We have received an unauthorized response but have no handlers to handle it.
                        // Let the response return to the caller.
                        return response;
                    }
                }
                let redirectsRemaining = this._maxRedirects;
                while (response.message.statusCode &&
                    HttpRedirectCodes.includes(response.message.statusCode) &&
                    this._allowRedirects &&
                    redirectsRemaining > 0) {
                    const redirectUrl = response.message.headers['location'];
                    if (!redirectUrl) {
                        // if there's no location to redirect to, we won't
                        break;
                    }
                    const parsedRedirectUrl = new URL(redirectUrl);
                    if (parsedUrl.protocol === 'https:' &&
                        parsedUrl.protocol !== parsedRedirectUrl.protocol &&
                        !this._allowRedirectDowngrade) {
                        throw new Error('Redirect from HTTPS to HTTP protocol. This downgrade is not allowed for security reasons. If you want to allow this behavior, set the allowRedirectDowngrade option to true.');
                    }
                    // we need to finish reading the response before reassigning response
                    // which will leak the open socket.
                    yield response.readBody();
                    // strip authorization header if redirected to a different hostname
                    if (parsedRedirectUrl.hostname !== parsedUrl.hostname) {
                        for (const header in headers) {
                            // header names are case insensitive
                            if (header.toLowerCase() === 'authorization') {
                                delete headers[header];
                            }
                        }
                    }
                    // let's make the request with the new redirectUrl
                    info = this._prepareRequest(verb, parsedRedirectUrl, headers);
                    response = yield this.requestRaw(info, data);
                    redirectsRemaining--;
                }
                if (!response.message.statusCode ||
                    !HttpResponseRetryCodes.includes(response.message.statusCode)) {
                    // If not a retry code, return immediately instead of retrying
                    return response;
                }
                numTries += 1;
                if (numTries < maxTries) {
                    yield response.readBody();
                    yield this._performExponentialBackoff(numTries);
                }
            } while (numTries < maxTries);
            return response;
        });
    }
    /**
     * Needs to be called if keepAlive is set to true in request options.
     */
    dispose() {
        if (this._agent) {
            this._agent.destroy();
        }
        this._disposed = true;
    }
    /**
     * Raw request.
     * @param info
     * @param data
     */
    requestRaw(info, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                function callbackForResult(err, res) {
                    if (err) {
                        reject(err);
                    }
                    else if (!res) {
                        // If `err` is not passed, then `res` must be passed.
                        reject(new Error('Unknown error'));
                    }
                    else {
                        resolve(res);
                    }
                }
                this.requestRawWithCallback(info, data, callbackForResult);
            });
        });
    }
    /**
     * Raw request with callback.
     * @param info
     * @param data
     * @param onResult
     */
    requestRawWithCallback(info, data, onResult) {
        if (typeof data === 'string') {
            if (!info.options.headers) {
                info.options.headers = {};
            }
            info.options.headers['Content-Length'] = Buffer.byteLength(data, 'utf8');
        }
        let callbackCalled = false;
        function handleResult(err, res) {
            if (!callbackCalled) {
                callbackCalled = true;
                onResult(err, res);
            }
        }
        const req = info.httpModule.request(info.options, (msg) => {
            const res = new HttpClientResponse(msg);
            handleResult(undefined, res);
        });
        let socket;
        req.on('socket', sock => {
            socket = sock;
        });
        // If we ever get disconnected, we want the socket to timeout eventually
        req.setTimeout(this._socketTimeout || 3 * 60000, () => {
            if (socket) {
                socket.end();
            }
            handleResult(new Error(`Request timeout: ${info.options.path}`));
        });
        req.on('error', function (err) {
            // err has statusCode property
            // res should have headers
            handleResult(err);
        });
        if (data && typeof data === 'string') {
            req.write(data, 'utf8');
        }
        if (data && typeof data !== 'string') {
            data.on('close', function () {
                req.end();
            });
            data.pipe(req);
        }
        else {
            req.end();
        }
    }
    /**
     * Gets an http agent. This function is useful when you need an http agent that handles
     * routing through a proxy server - depending upon the url and proxy environment variables.
     * @param serverUrl  The server URL where the request will be sent. For example, https://api.github.com
     */
    getAgent(serverUrl) {
        const parsedUrl = new URL(serverUrl);
        return this._getAgent(parsedUrl);
    }
    getAgentDispatcher(serverUrl) {
        const parsedUrl = new URL(serverUrl);
        const proxyUrl = pm.getProxyUrl(parsedUrl);
        const useProxy = proxyUrl && proxyUrl.hostname;
        if (!useProxy) {
            return;
        }
        return this._getProxyAgentDispatcher(parsedUrl, proxyUrl);
    }
    _prepareRequest(method, requestUrl, headers) {
        const info = {};
        info.parsedUrl = requestUrl;
        const usingSsl = info.parsedUrl.protocol === 'https:';
        info.httpModule = usingSsl ? https : http;
        const defaultPort = usingSsl ? 443 : 80;
        info.options = {};
        info.options.host = info.parsedUrl.hostname;
        info.options.port = info.parsedUrl.port
            ? parseInt(info.parsedUrl.port)
            : defaultPort;
        info.options.path =
            (info.parsedUrl.pathname || '') + (info.parsedUrl.search || '');
        info.options.method = method;
        info.options.headers = this._mergeHeaders(headers);
        if (this.userAgent != null) {
            info.options.headers['user-agent'] = this.userAgent;
        }
        info.options.agent = this._getAgent(info.parsedUrl);
        // gives handlers an opportunity to participate
        if (this.handlers) {
            for (const handler of this.handlers) {
                handler.prepareRequest(info.options);
            }
        }
        return info;
    }
    _mergeHeaders(headers) {
        if (this.requestOptions && this.requestOptions.headers) {
            return Object.assign({}, lowercaseKeys(this.requestOptions.headers), lowercaseKeys(headers || {}));
        }
        return lowercaseKeys(headers || {});
    }
    _getExistingOrDefaultHeader(additionalHeaders, header, _default) {
        let clientHeader;
        if (this.requestOptions && this.requestOptions.headers) {
            clientHeader = lowercaseKeys(this.requestOptions.headers)[header];
        }
        return additionalHeaders[header] || clientHeader || _default;
    }
    _getAgent(parsedUrl) {
        let agent;
        const proxyUrl = pm.getProxyUrl(parsedUrl);
        const useProxy = proxyUrl && proxyUrl.hostname;
        if (this._keepAlive && useProxy) {
            agent = this._proxyAgent;
        }
        if (!useProxy) {
            agent = this._agent;
        }
        // if agent is already assigned use that agent.
        if (agent) {
            return agent;
        }
        const usingSsl = parsedUrl.protocol === 'https:';
        let maxSockets = 100;
        if (this.requestOptions) {
            maxSockets = this.requestOptions.maxSockets || http.globalAgent.maxSockets;
        }
        // This is `useProxy` again, but we need to check `proxyURl` directly for TypeScripts's flow analysis.
        if (proxyUrl && proxyUrl.hostname) {
            const agentOptions = {
                maxSockets,
                keepAlive: this._keepAlive,
                proxy: Object.assign(Object.assign({}, ((proxyUrl.username || proxyUrl.password) && {
                    proxyAuth: `${proxyUrl.username}:${proxyUrl.password}`
                })), { host: proxyUrl.hostname, port: proxyUrl.port })
            };
            let tunnelAgent;
            const overHttps = proxyUrl.protocol === 'https:';
            if (usingSsl) {
                tunnelAgent = overHttps ? tunnel.httpsOverHttps : tunnel.httpsOverHttp;
            }
            else {
                tunnelAgent = overHttps ? tunnel.httpOverHttps : tunnel.httpOverHttp;
            }
            agent = tunnelAgent(agentOptions);
            this._proxyAgent = agent;
        }
        // if tunneling agent isn't assigned create a new agent
        if (!agent) {
            const options = { keepAlive: this._keepAlive, maxSockets };
            agent = usingSsl ? new https.Agent(options) : new http.Agent(options);
            this._agent = agent;
        }
        if (usingSsl && this._ignoreSslError) {
            // we don't want to set NODE_TLS_REJECT_UNAUTHORIZED=0 since that will affect request for entire process
            // http.RequestOptions doesn't expose a way to modify RequestOptions.agent.options
            // we have to cast it to any and change it directly
            agent.options = Object.assign(agent.options || {}, {
                rejectUnauthorized: false
            });
        }
        return agent;
    }
    _getProxyAgentDispatcher(parsedUrl, proxyUrl) {
        let proxyAgent;
        if (this._keepAlive) {
            proxyAgent = this._proxyAgentDispatcher;
        }
        // if agent is already assigned use that agent.
        if (proxyAgent) {
            return proxyAgent;
        }
        const usingSsl = parsedUrl.protocol === 'https:';
        proxyAgent = new undici_1.ProxyAgent(Object.assign({ uri: proxyUrl.href, pipelining: !this._keepAlive ? 0 : 1 }, ((proxyUrl.username || proxyUrl.password) && {
            token: `Basic ${Buffer.from(`${proxyUrl.username}:${proxyUrl.password}`).toString('base64')}`
        })));
        this._proxyAgentDispatcher = proxyAgent;
        if (usingSsl && this._ignoreSslError) {
            // we don't want to set NODE_TLS_REJECT_UNAUTHORIZED=0 since that will affect request for entire process
            // http.RequestOptions doesn't expose a way to modify RequestOptions.agent.options
            // we have to cast it to any and change it directly
            proxyAgent.options = Object.assign(proxyAgent.options.requestTls || {}, {
                rejectUnauthorized: false
            });
        }
        return proxyAgent;
    }
    _performExponentialBackoff(retryNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            retryNumber = Math.min(ExponentialBackoffCeiling, retryNumber);
            const ms = ExponentialBackoffTimeSlice * Math.pow(2, retryNumber);
            return new Promise(resolve => setTimeout(() => resolve(), ms));
        });
    }
    _processResponse(res, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                const statusCode = res.message.statusCode || 0;
                const response = {
                    statusCode,
                    result: null,
                    headers: {}
                };
                // not found leads to null obj returned
                if (statusCode === HttpCodes.NotFound) {
                    resolve(response);
                }
                // get the result from the body
                function dateTimeDeserializer(key, value) {
                    if (typeof value === 'string') {
                        const a = new Date(value);
                        if (!isNaN(a.valueOf())) {
                            return a;
                        }
                    }
                    return value;
                }
                let obj;
                let contents;
                try {
                    contents = yield res.readBody();
                    if (contents && contents.length > 0) {
                        if (options && options.deserializeDates) {
                            obj = JSON.parse(contents, dateTimeDeserializer);
                        }
                        else {
                            obj = JSON.parse(contents);
                        }
                        response.result = obj;
                    }
                    response.headers = res.message.headers;
                }
                catch (err) {
                    // Invalid resource (contents not json);  leaving result obj null
                }
                // note that 3xx redirects are handled by the http layer.
                if (statusCode > 299) {
                    let msg;
                    // if exception/error in body, attempt to get better error
                    if (obj && obj.message) {
                        msg = obj.message;
                    }
                    else if (contents && contents.length > 0) {
                        // it may be the case that the exception is in the body message as string
                        msg = contents;
                    }
                    else {
                        msg = `Failed request: (${statusCode})`;
                    }
                    const err = new HttpClientError(msg, statusCode);
                    err.result = response.result;
                    reject(err);
                }
                else {
                    resolve(response);
                }
            }));
        });
    }
}
exports.HttpClient = HttpClient;
const lowercaseKeys = (obj) => Object.keys(obj).reduce((c, k) => ((c[k.toLowerCase()] = obj[k]), c), {});
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 54988:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.checkBypass = exports.getProxyUrl = void 0;
function getProxyUrl(reqUrl) {
    const usingSsl = reqUrl.protocol === 'https:';
    if (checkBypass(reqUrl)) {
        return undefined;
    }
    const proxyVar = (() => {
        if (usingSsl) {
            return process.env['https_proxy'] || process.env['HTTPS_PROXY'];
        }
        else {
            return process.env['http_proxy'] || process.env['HTTP_PROXY'];
        }
    })();
    if (proxyVar) {
        try {
            return new DecodedURL(proxyVar);
        }
        catch (_a) {
            if (!proxyVar.startsWith('http://') && !proxyVar.startsWith('https://'))
                return new DecodedURL(`http://${proxyVar}`);
        }
    }
    else {
        return undefined;
    }
}
exports.getProxyUrl = getProxyUrl;
function checkBypass(reqUrl) {
    if (!reqUrl.hostname) {
        return false;
    }
    const reqHost = reqUrl.hostname;
    if (isLoopbackAddress(reqHost)) {
        return true;
    }
    const noProxy = process.env['no_proxy'] || process.env['NO_PROXY'] || '';
    if (!noProxy) {
        return false;
    }
    // Determine the request port
    let reqPort;
    if (reqUrl.port) {
        reqPort = Number(reqUrl.port);
    }
    else if (reqUrl.protocol === 'http:') {
        reqPort = 80;
    }
    else if (reqUrl.protocol === 'https:') {
        reqPort = 443;
    }
    // Format the request hostname and hostname with port
    const upperReqHosts = [reqUrl.hostname.toUpperCase()];
    if (typeof reqPort === 'number') {
        upperReqHosts.push(`${upperReqHosts[0]}:${reqPort}`);
    }
    // Compare request host against noproxy
    for (const upperNoProxyItem of noProxy
        .split(',')
        .map(x => x.trim().toUpperCase())
        .filter(x => x)) {
        if (upperNoProxyItem === '*' ||
            upperReqHosts.some(x => x === upperNoProxyItem ||
                x.endsWith(`.${upperNoProxyItem}`) ||
                (upperNoProxyItem.startsWith('.') &&
                    x.endsWith(`${upperNoProxyItem}`)))) {
            return true;
        }
    }
    return false;
}
exports.checkBypass = checkBypass;
function isLoopbackAddress(host) {
    const hostLower = host.toLowerCase();
    return (hostLower === 'localhost' ||
        hostLower.startsWith('127.') ||
        hostLower.startsWith('[::1]') ||
        hostLower.startsWith('[0:0:0:0:0:0:0:1]'));
}
class DecodedURL extends URL {
    constructor(url, base) {
        super(url, base);
        this._decodedUsername = decodeURIComponent(super.username);
        this._decodedPassword = decodeURIComponent(super.password);
    }
    get username() {
        return this._decodedUsername;
    }
    get password() {
        return this._decodedPassword;
    }
}
//# sourceMappingURL=proxy.js.map

/***/ }),

/***/ 75207:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getCmdPath = exports.tryGetExecutablePath = exports.isRooted = exports.isDirectory = exports.exists = exports.READONLY = exports.UV_FS_O_EXLOCK = exports.IS_WINDOWS = exports.unlink = exports.symlink = exports.stat = exports.rmdir = exports.rm = exports.rename = exports.readlink = exports.readdir = exports.open = exports.mkdir = exports.lstat = exports.copyFile = exports.chmod = void 0;
const fs = __importStar(__nccwpck_require__(79896));
const path = __importStar(__nccwpck_require__(16928));
_a = fs.promises
// export const {open} = 'fs'
, exports.chmod = _a.chmod, exports.copyFile = _a.copyFile, exports.lstat = _a.lstat, exports.mkdir = _a.mkdir, exports.open = _a.open, exports.readdir = _a.readdir, exports.readlink = _a.readlink, exports.rename = _a.rename, exports.rm = _a.rm, exports.rmdir = _a.rmdir, exports.stat = _a.stat, exports.symlink = _a.symlink, exports.unlink = _a.unlink;
// export const {open} = 'fs'
exports.IS_WINDOWS = process.platform === 'win32';
// See https://github.com/nodejs/node/blob/d0153aee367422d0858105abec186da4dff0a0c5/deps/uv/include/uv/win.h#L691
exports.UV_FS_O_EXLOCK = 0x10000000;
exports.READONLY = fs.constants.O_RDONLY;
function exists(fsPath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield exports.stat(fsPath);
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                return false;
            }
            throw err;
        }
        return true;
    });
}
exports.exists = exists;
function isDirectory(fsPath, useStat = false) {
    return __awaiter(this, void 0, void 0, function* () {
        const stats = useStat ? yield exports.stat(fsPath) : yield exports.lstat(fsPath);
        return stats.isDirectory();
    });
}
exports.isDirectory = isDirectory;
/**
 * On OSX/Linux, true if path starts with '/'. On Windows, true for paths like:
 * \, \hello, \\hello\share, C:, and C:\hello (and corresponding alternate separator cases).
 */
function isRooted(p) {
    p = normalizeSeparators(p);
    if (!p) {
        throw new Error('isRooted() parameter "p" cannot be empty');
    }
    if (exports.IS_WINDOWS) {
        return (p.startsWith('\\') || /^[A-Z]:/i.test(p) // e.g. \ or \hello or \\hello
        ); // e.g. C: or C:\hello
    }
    return p.startsWith('/');
}
exports.isRooted = isRooted;
/**
 * Best effort attempt to determine whether a file exists and is executable.
 * @param filePath    file path to check
 * @param extensions  additional file extensions to try
 * @return if file exists and is executable, returns the file path. otherwise empty string.
 */
function tryGetExecutablePath(filePath, extensions) {
    return __awaiter(this, void 0, void 0, function* () {
        let stats = undefined;
        try {
            // test file exists
            stats = yield exports.stat(filePath);
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                // eslint-disable-next-line no-console
                console.log(`Unexpected error attempting to determine if executable file exists '${filePath}': ${err}`);
            }
        }
        if (stats && stats.isFile()) {
            if (exports.IS_WINDOWS) {
                // on Windows, test for valid extension
                const upperExt = path.extname(filePath).toUpperCase();
                if (extensions.some(validExt => validExt.toUpperCase() === upperExt)) {
                    return filePath;
                }
            }
            else {
                if (isUnixExecutable(stats)) {
                    return filePath;
                }
            }
        }
        // try each extension
        const originalFilePath = filePath;
        for (const extension of extensions) {
            filePath = originalFilePath + extension;
            stats = undefined;
            try {
                stats = yield exports.stat(filePath);
            }
            catch (err) {
                if (err.code !== 'ENOENT') {
                    // eslint-disable-next-line no-console
                    console.log(`Unexpected error attempting to determine if executable file exists '${filePath}': ${err}`);
                }
            }
            if (stats && stats.isFile()) {
                if (exports.IS_WINDOWS) {
                    // preserve the case of the actual file (since an extension was appended)
                    try {
                        const directory = path.dirname(filePath);
                        const upperName = path.basename(filePath).toUpperCase();
                        for (const actualName of yield exports.readdir(directory)) {
                            if (upperName === actualName.toUpperCase()) {
                                filePath = path.join(directory, actualName);
                                break;
                            }
                        }
                    }
                    catch (err) {
                        // eslint-disable-next-line no-console
                        console.log(`Unexpected error attempting to determine the actual case of the file '${filePath}': ${err}`);
                    }
                    return filePath;
                }
                else {
                    if (isUnixExecutable(stats)) {
                        return filePath;
                    }
                }
            }
        }
        return '';
    });
}
exports.tryGetExecutablePath = tryGetExecutablePath;
function normalizeSeparators(p) {
    p = p || '';
    if (exports.IS_WINDOWS) {
        // convert slashes on Windows
        p = p.replace(/\//g, '\\');
        // remove redundant slashes
        return p.replace(/\\\\+/g, '\\');
    }
    // remove redundant slashes
    return p.replace(/\/\/+/g, '/');
}
// on Mac/Linux, test the execute bit
//     R   W  X  R  W X R W X
//   256 128 64 32 16 8 4 2 1
function isUnixExecutable(stats) {
    return ((stats.mode & 1) > 0 ||
        ((stats.mode & 8) > 0 && stats.gid === process.getgid()) ||
        ((stats.mode & 64) > 0 && stats.uid === process.getuid()));
}
// Get the path of cmd.exe in windows
function getCmdPath() {
    var _a;
    return (_a = process.env['COMSPEC']) !== null && _a !== void 0 ? _a : `cmd.exe`;
}
exports.getCmdPath = getCmdPath;
//# sourceMappingURL=io-util.js.map

/***/ }),

/***/ 94994:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.findInPath = exports.which = exports.mkdirP = exports.rmRF = exports.mv = exports.cp = void 0;
const assert_1 = __nccwpck_require__(42613);
const path = __importStar(__nccwpck_require__(16928));
const ioUtil = __importStar(__nccwpck_require__(75207));
/**
 * Copies a file or folder.
 * Based off of shelljs - https://github.com/shelljs/shelljs/blob/9237f66c52e5daa40458f94f9565e18e8132f5a6/src/cp.js
 *
 * @param     source    source path
 * @param     dest      destination path
 * @param     options   optional. See CopyOptions.
 */
function cp(source, dest, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const { force, recursive, copySourceDirectory } = readCopyOptions(options);
        const destStat = (yield ioUtil.exists(dest)) ? yield ioUtil.stat(dest) : null;
        // Dest is an existing file, but not forcing
        if (destStat && destStat.isFile() && !force) {
            return;
        }
        // If dest is an existing directory, should copy inside.
        const newDest = destStat && destStat.isDirectory() && copySourceDirectory
            ? path.join(dest, path.basename(source))
            : dest;
        if (!(yield ioUtil.exists(source))) {
            throw new Error(`no such file or directory: ${source}`);
        }
        const sourceStat = yield ioUtil.stat(source);
        if (sourceStat.isDirectory()) {
            if (!recursive) {
                throw new Error(`Failed to copy. ${source} is a directory, but tried to copy without recursive flag.`);
            }
            else {
                yield cpDirRecursive(source, newDest, 0, force);
            }
        }
        else {
            if (path.relative(source, newDest) === '') {
                // a file cannot be copied to itself
                throw new Error(`'${newDest}' and '${source}' are the same file`);
            }
            yield copyFile(source, newDest, force);
        }
    });
}
exports.cp = cp;
/**
 * Moves a path.
 *
 * @param     source    source path
 * @param     dest      destination path
 * @param     options   optional. See MoveOptions.
 */
function mv(source, dest, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield ioUtil.exists(dest)) {
            let destExists = true;
            if (yield ioUtil.isDirectory(dest)) {
                // If dest is directory copy src into dest
                dest = path.join(dest, path.basename(source));
                destExists = yield ioUtil.exists(dest);
            }
            if (destExists) {
                if (options.force == null || options.force) {
                    yield rmRF(dest);
                }
                else {
                    throw new Error('Destination already exists');
                }
            }
        }
        yield mkdirP(path.dirname(dest));
        yield ioUtil.rename(source, dest);
    });
}
exports.mv = mv;
/**
 * Remove a path recursively with force
 *
 * @param inputPath path to remove
 */
function rmRF(inputPath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (ioUtil.IS_WINDOWS) {
            // Check for invalid characters
            // https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file
            if (/[*"<>|]/.test(inputPath)) {
                throw new Error('File path must not contain `*`, `"`, `<`, `>` or `|` on Windows');
            }
        }
        try {
            // note if path does not exist, error is silent
            yield ioUtil.rm(inputPath, {
                force: true,
                maxRetries: 3,
                recursive: true,
                retryDelay: 300
            });
        }
        catch (err) {
            throw new Error(`File was unable to be removed ${err}`);
        }
    });
}
exports.rmRF = rmRF;
/**
 * Make a directory.  Creates the full path with folders in between
 * Will throw if it fails
 *
 * @param   fsPath        path to create
 * @returns Promise<void>
 */
function mkdirP(fsPath) {
    return __awaiter(this, void 0, void 0, function* () {
        assert_1.ok(fsPath, 'a path argument must be provided');
        yield ioUtil.mkdir(fsPath, { recursive: true });
    });
}
exports.mkdirP = mkdirP;
/**
 * Returns path of a tool had the tool actually been invoked.  Resolves via paths.
 * If you check and the tool does not exist, it will throw.
 *
 * @param     tool              name of the tool
 * @param     check             whether to check if tool exists
 * @returns   Promise<string>   path to tool
 */
function which(tool, check) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!tool) {
            throw new Error("parameter 'tool' is required");
        }
        // recursive when check=true
        if (check) {
            const result = yield which(tool, false);
            if (!result) {
                if (ioUtil.IS_WINDOWS) {
                    throw new Error(`Unable to locate executable file: ${tool}. Please verify either the file path exists or the file can be found within a directory specified by the PATH environment variable. Also verify the file has a valid extension for an executable file.`);
                }
                else {
                    throw new Error(`Unable to locate executable file: ${tool}. Please verify either the file path exists or the file can be found within a directory specified by the PATH environment variable. Also check the file mode to verify the file is executable.`);
                }
            }
            return result;
        }
        const matches = yield findInPath(tool);
        if (matches && matches.length > 0) {
            return matches[0];
        }
        return '';
    });
}
exports.which = which;
/**
 * Returns a list of all occurrences of the given tool on the system path.
 *
 * @returns   Promise<string[]>  the paths of the tool
 */
function findInPath(tool) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!tool) {
            throw new Error("parameter 'tool' is required");
        }
        // build the list of extensions to try
        const extensions = [];
        if (ioUtil.IS_WINDOWS && process.env['PATHEXT']) {
            for (const extension of process.env['PATHEXT'].split(path.delimiter)) {
                if (extension) {
                    extensions.push(extension);
                }
            }
        }
        // if it's rooted, return it if exists. otherwise return empty.
        if (ioUtil.isRooted(tool)) {
            const filePath = yield ioUtil.tryGetExecutablePath(tool, extensions);
            if (filePath) {
                return [filePath];
            }
            return [];
        }
        // if any path separators, return empty
        if (tool.includes(path.sep)) {
            return [];
        }
        // build the list of directories
        //
        // Note, technically "where" checks the current directory on Windows. From a toolkit perspective,
        // it feels like we should not do this. Checking the current directory seems like more of a use
        // case of a shell, and the which() function exposed by the toolkit should strive for consistency
        // across platforms.
        const directories = [];
        if (process.env.PATH) {
            for (const p of process.env.PATH.split(path.delimiter)) {
                if (p) {
                    directories.push(p);
                }
            }
        }
        // find all matches
        const matches = [];
        for (const directory of directories) {
            const filePath = yield ioUtil.tryGetExecutablePath(path.join(directory, tool), extensions);
            if (filePath) {
                matches.push(filePath);
            }
        }
        return matches;
    });
}
exports.findInPath = findInPath;
function readCopyOptions(options) {
    const force = options.force == null ? true : options.force;
    const recursive = Boolean(options.recursive);
    const copySourceDirectory = options.copySourceDirectory == null
        ? true
        : Boolean(options.copySourceDirectory);
    return { force, recursive, copySourceDirectory };
}
function cpDirRecursive(sourceDir, destDir, currentDepth, force) {
    return __awaiter(this, void 0, void 0, function* () {
        // Ensure there is not a run away recursive copy
        if (currentDepth >= 255)
            return;
        currentDepth++;
        yield mkdirP(destDir);
        const files = yield ioUtil.readdir(sourceDir);
        for (const fileName of files) {
            const srcFile = `${sourceDir}/${fileName}`;
            const destFile = `${destDir}/${fileName}`;
            const srcFileStat = yield ioUtil.lstat(srcFile);
            if (srcFileStat.isDirectory()) {
                // Recurse
                yield cpDirRecursive(srcFile, destFile, currentDepth, force);
            }
            else {
                yield copyFile(srcFile, destFile, force);
            }
        }
        // Change the mode for the newly created directory
        yield ioUtil.chmod(destDir, (yield ioUtil.stat(sourceDir)).mode);
    });
}
// Buffered file copy
function copyFile(srcFile, destFile, force) {
    return __awaiter(this, void 0, void 0, function* () {
        if ((yield ioUtil.lstat(srcFile)).isSymbolicLink()) {
            // unlink/re-link it
            try {
                yield ioUtil.lstat(destFile);
                yield ioUtil.unlink(destFile);
            }
            catch (e) {
                // Try to override file permission
                if (e.code === 'EPERM') {
                    yield ioUtil.chmod(destFile, '0666');
                    yield ioUtil.unlink(destFile);
                }
                // other errors = it doesn't exist, no work to do
            }
            // Copy over symlink
            const symlinkFull = yield ioUtil.readlink(srcFile);
            yield ioUtil.symlink(symlinkFull, destFile, ioUtil.IS_WINDOWS ? 'junction' : null);
        }
        else if (!(yield ioUtil.exists(destFile)) || force) {
            yield ioUtil.copyFile(srcFile, destFile);
        }
    });
}
//# sourceMappingURL=io.js.map

/***/ }),

/***/ 87721:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const net = __nccwpck_require__(69278)
const tls = __nccwpck_require__(64756)
const { once } = __nccwpck_require__(24434)
const timers = __nccwpck_require__(16460)
const { normalizeOptions, cacheOptions } = __nccwpck_require__(46329)
const { getProxy, getProxyAgent, proxyCache } = __nccwpck_require__(3799)
const Errors = __nccwpck_require__(60260)
const { Agent: AgentBase } = __nccwpck_require__(98894)

module.exports = class Agent extends AgentBase {
  #options
  #timeouts
  #proxy
  #noProxy
  #ProxyAgent

  constructor (options = {}) {
    const { timeouts, proxy, noProxy, ...normalizedOptions } = normalizeOptions(options)

    super(normalizedOptions)

    this.#options = normalizedOptions
    this.#timeouts = timeouts

    if (proxy) {
      this.#proxy = new URL(proxy)
      this.#noProxy = noProxy
      this.#ProxyAgent = getProxyAgent(proxy)
    }
  }

  get proxy () {
    return this.#proxy ? { url: this.#proxy } : {}
  }

  #getProxy (options) {
    if (!this.#proxy) {
      return
    }

    const proxy = getProxy(`${options.protocol}//${options.host}:${options.port}`, {
      proxy: this.#proxy,
      noProxy: this.#noProxy,
    })

    if (!proxy) {
      return
    }

    const cacheKey = cacheOptions({
      ...options,
      ...this.#options,
      timeouts: this.#timeouts,
      proxy,
    })

    if (proxyCache.has(cacheKey)) {
      return proxyCache.get(cacheKey)
    }

    let ProxyAgent = this.#ProxyAgent
    if (Array.isArray(ProxyAgent)) {
      ProxyAgent = this.isSecureEndpoint(options) ? ProxyAgent[1] : ProxyAgent[0]
    }

    const proxyAgent = new ProxyAgent(proxy, {
      ...this.#options,
      socketOptions: { family: this.#options.family },
    })
    proxyCache.set(cacheKey, proxyAgent)

    return proxyAgent
  }

  // takes an array of promises and races them against the connection timeout
  // which will throw the necessary error if it is hit. This will return the
  // result of the promise race.
  async #timeoutConnection ({ promises, options, timeout }, ac = new AbortController()) {
    if (timeout) {
      const connectionTimeout = timers.setTimeout(timeout, null, { signal: ac.signal })
        .then(() => {
          throw new Errors.ConnectionTimeoutError(`${options.host}:${options.port}`)
        }).catch((err) => {
          if (err.name === 'AbortError') {
            return
          }
          throw err
        })
      promises.push(connectionTimeout)
    }

    let result
    try {
      result = await Promise.race(promises)
      ac.abort()
    } catch (err) {
      ac.abort()
      throw err
    }
    return result
  }

  async connect (request, options) {
    // if the connection does not have its own lookup function
    // set, then use the one from our options
    options.lookup ??= this.#options.lookup

    let socket
    let timeout = this.#timeouts.connection
    const isSecureEndpoint = this.isSecureEndpoint(options)

    const proxy = this.#getProxy(options)
    if (proxy) {
      // some of the proxies will wait for the socket to fully connect before
      // returning so we have to await this while also racing it against the
      // connection timeout.
      const start = Date.now()
      socket = await this.#timeoutConnection({
        options,
        timeout,
        promises: [proxy.connect(request, options)],
      })
      // see how much time proxy.connect took and subtract it from
      // the timeout
      if (timeout) {
        timeout = timeout - (Date.now() - start)
      }
    } else {
      socket = (isSecureEndpoint ? tls : net).connect(options)
    }

    socket.setKeepAlive(this.keepAlive, this.keepAliveMsecs)
    socket.setNoDelay(this.keepAlive)

    const abortController = new AbortController()
    const { signal } = abortController

    const connectPromise = socket[isSecureEndpoint ? 'secureConnecting' : 'connecting']
      ? once(socket, isSecureEndpoint ? 'secureConnect' : 'connect', { signal })
      : Promise.resolve()

    await this.#timeoutConnection({
      options,
      timeout,
      promises: [
        connectPromise,
        once(socket, 'error', { signal }).then((err) => {
          throw err[0]
        }),
      ],
    }, abortController)

    if (this.#timeouts.idle) {
      socket.setTimeout(this.#timeouts.idle, () => {
        socket.destroy(new Errors.IdleTimeoutError(`${options.host}:${options.port}`))
      })
    }

    return socket
  }

  addRequest (request, options) {
    const proxy = this.#getProxy(options)
    // it would be better to call proxy.addRequest here but this causes the
    // http-proxy-agent to call its super.addRequest which causes the request
    // to be added to the agent twice. since we only support 3 agents
    // currently (see the required agents in proxy.js) we have manually
    // checked that the only public methods we need to call are called in the
    // next block. this could change in the future and presumably we would get
    // failing tests until we have properly called the necessary methods on
    // each of our proxy agents
    if (proxy?.setRequestProps) {
      proxy.setRequestProps(request, options)
    }

    request.setHeader('connection', this.keepAlive ? 'keep-alive' : 'close')

    if (this.#timeouts.response) {
      let responseTimeout
      request.once('finish', () => {
        setTimeout(() => {
          request.destroy(new Errors.ResponseTimeoutError(request, this.#proxy))
        }, this.#timeouts.response)
      })
      request.once('response', () => {
        clearTimeout(responseTimeout)
      })
    }

    if (this.#timeouts.transfer) {
      let transferTimeout
      request.once('response', (res) => {
        setTimeout(() => {
          res.destroy(new Errors.TransferTimeoutError(request, this.#proxy))
        }, this.#timeouts.transfer)
        res.once('close', () => {
          clearTimeout(transferTimeout)
        })
      })
    }

    return super.addRequest(request, options)
  }
}


/***/ }),

/***/ 42604:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const { LRUCache } = __nccwpck_require__(32638)
const dns = __nccwpck_require__(72250)

// this is a factory so that each request can have its own opts (i.e. ttl)
// while still sharing the cache across all requests
const cache = new LRUCache({ max: 50 })

const getOptions = ({
  family = 0,
  hints = dns.ADDRCONFIG,
  all = false,
  verbatim = undefined,
  ttl = 5 * 60 * 1000,
  lookup = dns.lookup,
}) => ({
  // hints and lookup are returned since both are top level properties to (net|tls).connect
  hints,
  lookup: (hostname, ...args) => {
    const callback = args.pop() // callback is always last arg
    const lookupOptions = args[0] ?? {}

    const options = {
      family,
      hints,
      all,
      verbatim,
      ...(typeof lookupOptions === 'number' ? { family: lookupOptions } : lookupOptions),
    }

    const key = JSON.stringify({ hostname, ...options })

    if (cache.has(key)) {
      const cached = cache.get(key)
      return process.nextTick(callback, null, ...cached)
    }

    lookup(hostname, options, (err, ...result) => {
      if (err) {
        return callback(err)
      }

      cache.set(key, result, { ttl })
      return callback(null, ...result)
    })
  },
})

module.exports = {
  cache,
  getOptions,
}


/***/ }),

/***/ 60260:
/***/ ((module) => {

"use strict";


class InvalidProxyProtocolError extends Error {
  constructor (url) {
    super(`Invalid protocol \`${url.protocol}\` connecting to proxy \`${url.host}\``)
    this.code = 'EINVALIDPROXY'
    this.proxy = url
  }
}

class ConnectionTimeoutError extends Error {
  constructor (host) {
    super(`Timeout connecting to host \`${host}\``)
    this.code = 'ECONNECTIONTIMEOUT'
    this.host = host
  }
}

class IdleTimeoutError extends Error {
  constructor (host) {
    super(`Idle timeout reached for host \`${host}\``)
    this.code = 'EIDLETIMEOUT'
    this.host = host
  }
}

class ResponseTimeoutError extends Error {
  constructor (request, proxy) {
    let msg = 'Response timeout '
    if (proxy) {
      msg += `from proxy \`${proxy.host}\` `
    }
    msg += `connecting to host \`${request.host}\``
    super(msg)
    this.code = 'ERESPONSETIMEOUT'
    this.proxy = proxy
    this.request = request
  }
}

class TransferTimeoutError extends Error {
  constructor (request, proxy) {
    let msg = 'Transfer timeout '
    if (proxy) {
      msg += `from proxy \`${proxy.host}\` `
    }
    msg += `for \`${request.host}\``
    super(msg)
    this.code = 'ETRANSFERTIMEOUT'
    this.proxy = proxy
    this.request = request
  }
}

module.exports = {
  InvalidProxyProtocolError,
  ConnectionTimeoutError,
  IdleTimeoutError,
  ResponseTimeoutError,
  TransferTimeoutError,
}


/***/ }),

/***/ 57995:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const { LRUCache } = __nccwpck_require__(32638)
const { normalizeOptions, cacheOptions } = __nccwpck_require__(46329)
const { getProxy, proxyCache } = __nccwpck_require__(3799)
const dns = __nccwpck_require__(42604)
const Agent = __nccwpck_require__(87721)

const agentCache = new LRUCache({ max: 20 })

const getAgent = (url, { agent, proxy, noProxy, ...options } = {}) => {
  // false has meaning so this can't be a simple truthiness check
  if (agent != null) {
    return agent
  }

  url = new URL(url)

  const proxyForUrl = getProxy(url, { proxy, noProxy })
  const normalizedOptions = {
    ...normalizeOptions(options),
    proxy: proxyForUrl,
  }

  const cacheKey = cacheOptions({
    ...normalizedOptions,
    secureEndpoint: url.protocol === 'https:',
  })

  if (agentCache.has(cacheKey)) {
    return agentCache.get(cacheKey)
  }

  const newAgent = new Agent(normalizedOptions)
  agentCache.set(cacheKey, newAgent)

  return newAgent
}

module.exports = {
  getAgent,
  Agent,
  // these are exported for backwards compatability
  HttpAgent: Agent,
  HttpsAgent: Agent,
  cache: {
    proxy: proxyCache,
    agent: agentCache,
    dns: dns.cache,
    clear: () => {
      proxyCache.clear()
      agentCache.clear()
      dns.cache.clear()
    },
  },
}


/***/ }),

/***/ 46329:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const dns = __nccwpck_require__(42604)

const normalizeOptions = (opts) => {
  const family = parseInt(opts.family ?? '0', 10)
  const keepAlive = opts.keepAlive ?? true

  const normalized = {
    // nodejs http agent options. these are all the defaults
    // but kept here to increase the likelihood of cache hits
    // https://nodejs.org/api/http.html#new-agentoptions
    keepAliveMsecs: keepAlive ? 1000 : undefined,
    maxSockets: opts.maxSockets ?? 15,
    maxTotalSockets: Infinity,
    maxFreeSockets: keepAlive ? 256 : undefined,
    scheduling: 'fifo',
    // then spread the rest of the options
    ...opts,
    // we already set these to their defaults that we want
    family,
    keepAlive,
    // our custom timeout options
    timeouts: {
      // the standard timeout option is mapped to our idle timeout
      // and then deleted below
      idle: opts.timeout ?? 0,
      connection: 0,
      response: 0,
      transfer: 0,
      ...opts.timeouts,
    },
    // get the dns options that go at the top level of socket connection
    ...dns.getOptions({ family, ...opts.dns }),
  }

  // remove timeout since we already used it to set our own idle timeout
  delete normalized.timeout

  return normalized
}

const createKey = (obj) => {
  let key = ''
  const sorted = Object.entries(obj).sort((a, b) => a[0] - b[0])
  for (let [k, v] of sorted) {
    if (v == null) {
      v = 'null'
    } else if (v instanceof URL) {
      v = v.toString()
    } else if (typeof v === 'object') {
      v = createKey(v)
    }
    key += `${k}:${v}:`
  }
  return key
}

const cacheOptions = ({ secureEndpoint, ...options }) => createKey({
  secureEndpoint: !!secureEndpoint,
  // socket connect options
  family: options.family,
  hints: options.hints,
  localAddress: options.localAddress,
  // tls specific connect options
  strictSsl: secureEndpoint ? !!options.rejectUnauthorized : false,
  ca: secureEndpoint ? options.ca : null,
  cert: secureEndpoint ? options.cert : null,
  key: secureEndpoint ? options.key : null,
  // http agent options
  keepAlive: options.keepAlive,
  keepAliveMsecs: options.keepAliveMsecs,
  maxSockets: options.maxSockets,
  maxTotalSockets: options.maxTotalSockets,
  maxFreeSockets: options.maxFreeSockets,
  scheduling: options.scheduling,
  // timeout options
  timeouts: options.timeouts,
  // proxy
  proxy: options.proxy,
})

module.exports = {
  normalizeOptions,
  cacheOptions,
}


/***/ }),

/***/ 3799:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const { HttpProxyAgent } = __nccwpck_require__(81970)
const { HttpsProxyAgent } = __nccwpck_require__(3669)
const { SocksProxyAgent } = __nccwpck_require__(53357)
const { LRUCache } = __nccwpck_require__(32638)
const { InvalidProxyProtocolError } = __nccwpck_require__(60260)

const PROXY_CACHE = new LRUCache({ max: 20 })

const SOCKS_PROTOCOLS = new Set(SocksProxyAgent.protocols)

const PROXY_ENV_KEYS = new Set(['https_proxy', 'http_proxy', 'proxy', 'no_proxy'])

const PROXY_ENV = Object.entries(process.env).reduce((acc, [key, value]) => {
  key = key.toLowerCase()
  if (PROXY_ENV_KEYS.has(key)) {
    acc[key] = value
  }
  return acc
}, {})

const getProxyAgent = (url) => {
  url = new URL(url)

  const protocol = url.protocol.slice(0, -1)
  if (SOCKS_PROTOCOLS.has(protocol)) {
    return SocksProxyAgent
  }
  if (protocol === 'https' || protocol === 'http') {
    return [HttpProxyAgent, HttpsProxyAgent]
  }

  throw new InvalidProxyProtocolError(url)
}

const isNoProxy = (url, noProxy) => {
  if (typeof noProxy === 'string') {
    noProxy = noProxy.split(',').map((p) => p.trim()).filter(Boolean)
  }

  if (!noProxy || !noProxy.length) {
    return false
  }

  const hostSegments = url.hostname.split('.').reverse()

  return noProxy.some((no) => {
    const noSegments = no.split('.').filter(Boolean).reverse()
    if (!noSegments.length) {
      return false
    }

    for (let i = 0; i < noSegments.length; i++) {
      if (hostSegments[i] !== noSegments[i]) {
        return false
      }
    }

    return true
  })
}

const getProxy = (url, { proxy, noProxy }) => {
  url = new URL(url)

  if (!proxy) {
    proxy = url.protocol === 'https:'
      ? PROXY_ENV.https_proxy
      : PROXY_ENV.https_proxy || PROXY_ENV.http_proxy || PROXY_ENV.proxy
  }

  if (!noProxy) {
    noProxy = PROXY_ENV.no_proxy
  }

  if (!proxy || isNoProxy(url, noProxy)) {
    return null
  }

  return new URL(proxy)
}

module.exports = {
  getProxyAgent,
  getProxy,
  proxyCache: PROXY_CACHE,
}


/***/ }),

/***/ 84212:
/***/ ((module) => {

// given an input that may or may not be an object, return an object that has
// a copy of every defined property listed in 'copy'. if the input is not an
// object, assign it to the property named by 'wrap'
const getOptions = (input, { copy, wrap }) => {
  const result = {}

  if (input && typeof input === 'object') {
    for (const prop of copy) {
      if (input[prop] !== undefined) {
        result[prop] = input[prop]
      }
    }
  } else {
    result[wrap] = input
  }

  return result
}

module.exports = getOptions


/***/ }),

/***/ 6187:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const semver = __nccwpck_require__(62088)

const satisfies = (range) => {
  return semver.satisfies(process.version, range, { includePrerelease: true })
}

module.exports = {
  satisfies,
}


/***/ }),

/***/ 88314:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";

const { inspect } = __nccwpck_require__(39023)

// adapted from node's internal/errors
// https://github.com/nodejs/node/blob/c8a04049/lib/internal/errors.js

// close copy of node's internal SystemError class.
class SystemError {
  constructor (code, prefix, context) {
    // XXX context.code is undefined in all constructors used in cp/polyfill
    // that may be a bug copied from node, maybe the constructor should use
    // `code` not `errno`?  nodejs/node#41104
    let message = `${prefix}: ${context.syscall} returned ` +
                  `${context.code} (${context.message})`

    if (context.path !== undefined) {
      message += ` ${context.path}`
    }
    if (context.dest !== undefined) {
      message += ` => ${context.dest}`
    }

    this.code = code
    Object.defineProperties(this, {
      name: {
        value: 'SystemError',
        enumerable: false,
        writable: true,
        configurable: true,
      },
      message: {
        value: message,
        enumerable: false,
        writable: true,
        configurable: true,
      },
      info: {
        value: context,
        enumerable: true,
        configurable: true,
        writable: false,
      },
      errno: {
        get () {
          return context.errno
        },
        set (value) {
          context.errno = value
        },
        enumerable: true,
        configurable: true,
      },
      syscall: {
        get () {
          return context.syscall
        },
        set (value) {
          context.syscall = value
        },
        enumerable: true,
        configurable: true,
      },
    })

    if (context.path !== undefined) {
      Object.defineProperty(this, 'path', {
        get () {
          return context.path
        },
        set (value) {
          context.path = value
        },
        enumerable: true,
        configurable: true,
      })
    }

    if (context.dest !== undefined) {
      Object.defineProperty(this, 'dest', {
        get () {
          return context.dest
        },
        set (value) {
          context.dest = value
        },
        enumerable: true,
        configurable: true,
      })
    }
  }

  toString () {
    return `${this.name} [${this.code}]: ${this.message}`
  }

  [Symbol.for('nodejs.util.inspect.custom')] (_recurseTimes, ctx) {
    return inspect(this, {
      ...ctx,
      getters: true,
      customInspect: false,
    })
  }
}

function E (code, message) {
  module.exports[code] = class NodeError extends SystemError {
    constructor (ctx) {
      super(code, message, ctx)
    }
  }
}

E('ERR_FS_CP_DIR_TO_NON_DIR', 'Cannot overwrite directory with non-directory')
E('ERR_FS_CP_EEXIST', 'Target already exists')
E('ERR_FS_CP_EINVAL', 'Invalid src or dest')
E('ERR_FS_CP_FIFO_PIPE', 'Cannot copy a FIFO pipe')
E('ERR_FS_CP_NON_DIR_TO_DIR', 'Cannot overwrite non-directory with directory')
E('ERR_FS_CP_SOCKET', 'Cannot copy a socket file')
E('ERR_FS_CP_SYMLINK_TO_SUBDIRECTORY', 'Cannot overwrite symlink in subdirectory of self')
E('ERR_FS_CP_UNKNOWN', 'Cannot copy an unknown file type')
E('ERR_FS_EISDIR', 'Path is a directory')

module.exports.ERR_INVALID_ARG_TYPE = class ERR_INVALID_ARG_TYPE extends Error {
  constructor (name, expected, actual) {
    super()
    this.code = 'ERR_INVALID_ARG_TYPE'
    this.message = `The ${name} argument must be ${expected}. Received ${typeof actual}`
  }
}


/***/ }),

/***/ 35189:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const fs = __nccwpck_require__(91943)
const getOptions = __nccwpck_require__(84212)
const node = __nccwpck_require__(6187)
const polyfill = __nccwpck_require__(76562)

// node 16.7.0 added fs.cp
const useNative = node.satisfies('>=16.7.0')

const cp = async (src, dest, opts) => {
  const options = getOptions(opts, {
    copy: ['dereference', 'errorOnExist', 'filter', 'force', 'preserveTimestamps', 'recursive'],
  })

  // the polyfill is tested separately from this module, no need to hack
  // process.version to try to trigger it just for coverage
  // istanbul ignore next
  return useNative
    ? fs.cp(src, dest, options)
    : polyfill(src, dest, options)
}

module.exports = cp


/***/ }),

/***/ 76562:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";
// this file is a modified version of the code in node 17.2.0
// which is, in turn, a modified version of the fs-extra module on npm
// node core changes:
// - Use of the assert module has been replaced with core's error system.
// - All code related to the glob dependency has been removed.
// - Bring your own custom fs module is not currently supported.
// - Some basic code cleanup.
// changes here:
// - remove all callback related code
// - drop sync support
// - change assertions back to non-internal methods (see options.js)
// - throws ENOTDIR when rmdir gets an ENOENT for a path that exists in Windows


const {
  ERR_FS_CP_DIR_TO_NON_DIR,
  ERR_FS_CP_EEXIST,
  ERR_FS_CP_EINVAL,
  ERR_FS_CP_FIFO_PIPE,
  ERR_FS_CP_NON_DIR_TO_DIR,
  ERR_FS_CP_SOCKET,
  ERR_FS_CP_SYMLINK_TO_SUBDIRECTORY,
  ERR_FS_CP_UNKNOWN,
  ERR_FS_EISDIR,
  ERR_INVALID_ARG_TYPE,
} = __nccwpck_require__(88314)
const {
  constants: {
    errno: {
      EEXIST,
      EISDIR,
      EINVAL,
      ENOTDIR,
    },
  },
} = __nccwpck_require__(70857)
const {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readdir,
  readlink,
  stat,
  symlink,
  unlink,
  utimes,
} = __nccwpck_require__(91943)
const {
  dirname,
  isAbsolute,
  join,
  parse,
  resolve,
  sep,
  toNamespacedPath,
} = __nccwpck_require__(16928)
const { fileURLToPath } = __nccwpck_require__(87016)

const defaultOptions = {
  dereference: false,
  errorOnExist: false,
  filter: undefined,
  force: true,
  preserveTimestamps: false,
  recursive: false,
}

async function cp (src, dest, opts) {
  if (opts != null && typeof opts !== 'object') {
    throw new ERR_INVALID_ARG_TYPE('options', ['Object'], opts)
  }
  return cpFn(
    toNamespacedPath(getValidatedPath(src)),
    toNamespacedPath(getValidatedPath(dest)),
    { ...defaultOptions, ...opts })
}

function getValidatedPath (fileURLOrPath) {
  const path = fileURLOrPath != null && fileURLOrPath.href
      && fileURLOrPath.origin
    ? fileURLToPath(fileURLOrPath)
    : fileURLOrPath
  return path
}

async function cpFn (src, dest, opts) {
  // Warn about using preserveTimestamps on 32-bit node
  // istanbul ignore next
  if (opts.preserveTimestamps && process.arch === 'ia32') {
    const warning = 'Using the preserveTimestamps option in 32-bit ' +
      'node is not recommended'
    process.emitWarning(warning, 'TimestampPrecisionWarning')
  }
  const stats = await checkPaths(src, dest, opts)
  const { srcStat, destStat } = stats
  await checkParentPaths(src, srcStat, dest)
  if (opts.filter) {
    return handleFilter(checkParentDir, destStat, src, dest, opts)
  }
  return checkParentDir(destStat, src, dest, opts)
}

async function checkPaths (src, dest, opts) {
  const { 0: srcStat, 1: destStat } = await getStats(src, dest, opts)
  if (destStat) {
    if (areIdentical(srcStat, destStat)) {
      throw new ERR_FS_CP_EINVAL({
        message: 'src and dest cannot be the same',
        path: dest,
        syscall: 'cp',
        errno: EINVAL,
      })
    }
    if (srcStat.isDirectory() && !destStat.isDirectory()) {
      throw new ERR_FS_CP_DIR_TO_NON_DIR({
        message: `cannot overwrite directory ${src} ` +
            `with non-directory ${dest}`,
        path: dest,
        syscall: 'cp',
        errno: EISDIR,
      })
    }
    if (!srcStat.isDirectory() && destStat.isDirectory()) {
      throw new ERR_FS_CP_NON_DIR_TO_DIR({
        message: `cannot overwrite non-directory ${src} ` +
            `with directory ${dest}`,
        path: dest,
        syscall: 'cp',
        errno: ENOTDIR,
      })
    }
  }

  if (srcStat.isDirectory() && isSrcSubdir(src, dest)) {
    throw new ERR_FS_CP_EINVAL({
      message: `cannot copy ${src} to a subdirectory of self ${dest}`,
      path: dest,
      syscall: 'cp',
      errno: EINVAL,
    })
  }
  return { srcStat, destStat }
}

function areIdentical (srcStat, destStat) {
  return destStat.ino && destStat.dev && destStat.ino === srcStat.ino &&
    destStat.dev === srcStat.dev
}

function getStats (src, dest, opts) {
  const statFunc = opts.dereference ?
    (file) => stat(file, { bigint: true }) :
    (file) => lstat(file, { bigint: true })
  return Promise.all([
    statFunc(src),
    statFunc(dest).catch((err) => {
      // istanbul ignore next: unsure how to cover.
      if (err.code === 'ENOENT') {
        return null
      }
      // istanbul ignore next: unsure how to cover.
      throw err
    }),
  ])
}

async function checkParentDir (destStat, src, dest, opts) {
  const destParent = dirname(dest)
  const dirExists = await pathExists(destParent)
  if (dirExists) {
    return getStatsForCopy(destStat, src, dest, opts)
  }
  await mkdir(destParent, { recursive: true })
  return getStatsForCopy(destStat, src, dest, opts)
}

function pathExists (dest) {
  return stat(dest).then(
    () => true,
    // istanbul ignore next: not sure when this would occur
    (err) => (err.code === 'ENOENT' ? false : Promise.reject(err)))
}

// Recursively check if dest parent is a subdirectory of src.
// It works for all file types including symlinks since it
// checks the src and dest inodes. It starts from the deepest
// parent and stops once it reaches the src parent or the root path.
async function checkParentPaths (src, srcStat, dest) {
  const srcParent = resolve(dirname(src))
  const destParent = resolve(dirname(dest))
  if (destParent === srcParent || destParent === parse(destParent).root) {
    return
  }
  let destStat
  try {
    destStat = await stat(destParent, { bigint: true })
  } catch (err) {
    // istanbul ignore else: not sure when this would occur
    if (err.code === 'ENOENT') {
      return
    }
    // istanbul ignore next: not sure when this would occur
    throw err
  }
  if (areIdentical(srcStat, destStat)) {
    throw new ERR_FS_CP_EINVAL({
      message: `cannot copy ${src} to a subdirectory of self ${dest}`,
      path: dest,
      syscall: 'cp',
      errno: EINVAL,
    })
  }
  return checkParentPaths(src, srcStat, destParent)
}

const normalizePathToArray = (path) =>
  resolve(path).split(sep).filter(Boolean)

// Return true if dest is a subdir of src, otherwise false.
// It only checks the path strings.
function isSrcSubdir (src, dest) {
  const srcArr = normalizePathToArray(src)
  const destArr = normalizePathToArray(dest)
  return srcArr.every((cur, i) => destArr[i] === cur)
}

async function handleFilter (onInclude, destStat, src, dest, opts, cb) {
  const include = await opts.filter(src, dest)
  if (include) {
    return onInclude(destStat, src, dest, opts, cb)
  }
}

function startCopy (destStat, src, dest, opts) {
  if (opts.filter) {
    return handleFilter(getStatsForCopy, destStat, src, dest, opts)
  }
  return getStatsForCopy(destStat, src, dest, opts)
}

async function getStatsForCopy (destStat, src, dest, opts) {
  const statFn = opts.dereference ? stat : lstat
  const srcStat = await statFn(src)
  // istanbul ignore else: can't portably test FIFO
  if (srcStat.isDirectory() && opts.recursive) {
    return onDir(srcStat, destStat, src, dest, opts)
  } else if (srcStat.isDirectory()) {
    throw new ERR_FS_EISDIR({
      message: `${src} is a directory (not copied)`,
      path: src,
      syscall: 'cp',
      errno: EINVAL,
    })
  } else if (srcStat.isFile() ||
            srcStat.isCharacterDevice() ||
            srcStat.isBlockDevice()) {
    return onFile(srcStat, destStat, src, dest, opts)
  } else if (srcStat.isSymbolicLink()) {
    return onLink(destStat, src, dest)
  } else if (srcStat.isSocket()) {
    throw new ERR_FS_CP_SOCKET({
      message: `cannot copy a socket file: ${dest}`,
      path: dest,
      syscall: 'cp',
      errno: EINVAL,
    })
  } else if (srcStat.isFIFO()) {
    throw new ERR_FS_CP_FIFO_PIPE({
      message: `cannot copy a FIFO pipe: ${dest}`,
      path: dest,
      syscall: 'cp',
      errno: EINVAL,
    })
  }
  // istanbul ignore next: should be unreachable
  throw new ERR_FS_CP_UNKNOWN({
    message: `cannot copy an unknown file type: ${dest}`,
    path: dest,
    syscall: 'cp',
    errno: EINVAL,
  })
}

function onFile (srcStat, destStat, src, dest, opts) {
  if (!destStat) {
    return _copyFile(srcStat, src, dest, opts)
  }
  return mayCopyFile(srcStat, src, dest, opts)
}

async function mayCopyFile (srcStat, src, dest, opts) {
  if (opts.force) {
    await unlink(dest)
    return _copyFile(srcStat, src, dest, opts)
  } else if (opts.errorOnExist) {
    throw new ERR_FS_CP_EEXIST({
      message: `${dest} already exists`,
      path: dest,
      syscall: 'cp',
      errno: EEXIST,
    })
  }
}

async function _copyFile (srcStat, src, dest, opts) {
  await copyFile(src, dest)
  if (opts.preserveTimestamps) {
    return handleTimestampsAndMode(srcStat.mode, src, dest)
  }
  return setDestMode(dest, srcStat.mode)
}

async function handleTimestampsAndMode (srcMode, src, dest) {
  // Make sure the file is writable before setting the timestamp
  // otherwise open fails with EPERM when invoked with 'r+'
  // (through utimes call)
  if (fileIsNotWritable(srcMode)) {
    await makeFileWritable(dest, srcMode)
    return setDestTimestampsAndMode(srcMode, src, dest)
  }
  return setDestTimestampsAndMode(srcMode, src, dest)
}

function fileIsNotWritable (srcMode) {
  return (srcMode & 0o200) === 0
}

function makeFileWritable (dest, srcMode) {
  return setDestMode(dest, srcMode | 0o200)
}

async function setDestTimestampsAndMode (srcMode, src, dest) {
  await setDestTimestamps(src, dest)
  return setDestMode(dest, srcMode)
}

function setDestMode (dest, srcMode) {
  return chmod(dest, srcMode)
}

async function setDestTimestamps (src, dest) {
  // The initial srcStat.atime cannot be trusted
  // because it is modified by the read(2) system call
  // (See https://nodejs.org/api/fs.html#fs_stat_time_values)
  const updatedSrcStat = await stat(src)
  return utimes(dest, updatedSrcStat.atime, updatedSrcStat.mtime)
}

function onDir (srcStat, destStat, src, dest, opts) {
  if (!destStat) {
    return mkDirAndCopy(srcStat.mode, src, dest, opts)
  }
  return copyDir(src, dest, opts)
}

async function mkDirAndCopy (srcMode, src, dest, opts) {
  await mkdir(dest)
  await copyDir(src, dest, opts)
  return setDestMode(dest, srcMode)
}

async function copyDir (src, dest, opts) {
  const dir = await readdir(src)
  for (let i = 0; i < dir.length; i++) {
    const item = dir[i]
    const srcItem = join(src, item)
    const destItem = join(dest, item)
    const { destStat } = await checkPaths(srcItem, destItem, opts)
    await startCopy(destStat, srcItem, destItem, opts)
  }
}

async function onLink (destStat, src, dest) {
  let resolvedSrc = await readlink(src)
  if (!isAbsolute(resolvedSrc)) {
    resolvedSrc = resolve(dirname(src), resolvedSrc)
  }
  if (!destStat) {
    return symlink(resolvedSrc, dest)
  }
  let resolvedDest
  try {
    resolvedDest = await readlink(dest)
  } catch (err) {
    // Dest exists and is a regular file or directory,
    // Windows may throw UNKNOWN error. If dest already exists,
    // fs throws error anyway, so no need to guard against it here.
    // istanbul ignore next: can only test on windows
    if (err.code === 'EINVAL' || err.code === 'UNKNOWN') {
      return symlink(resolvedSrc, dest)
    }
    // istanbul ignore next: should not be possible
    throw err
  }
  if (!isAbsolute(resolvedDest)) {
    resolvedDest = resolve(dirname(dest), resolvedDest)
  }
  if (isSrcSubdir(resolvedSrc, resolvedDest)) {
    throw new ERR_FS_CP_EINVAL({
      message: `cannot copy ${resolvedSrc} to a subdirectory of self ` +
            `${resolvedDest}`,
      path: dest,
      syscall: 'cp',
      errno: EINVAL,
    })
  }
  // Do not copy if src is a subdir of dest since unlinking
  // dest in this case would result in removing src contents
  // and therefore a broken symlink would be created.
  const srcStat = await stat(src)
  if (srcStat.isDirectory() && isSrcSubdir(resolvedDest, resolvedSrc)) {
    throw new ERR_FS_CP_SYMLINK_TO_SUBDIRECTORY({
      message: `cannot overwrite ${resolvedDest} with ${resolvedSrc}`,
      path: dest,
      syscall: 'cp',
      errno: EINVAL,
    })
  }
  return copyLink(resolvedSrc, dest)
}

async function copyLink (resolvedSrc, dest) {
  await unlink(dest)
  return symlink(resolvedSrc, dest)
}

module.exports = cp


/***/ }),

/***/ 88437:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const cp = __nccwpck_require__(35189)
const withTempDir = __nccwpck_require__(16974)
const readdirScoped = __nccwpck_require__(99367)
const moveFile = __nccwpck_require__(64851)

module.exports = {
  cp,
  withTempDir,
  readdirScoped,
  moveFile,
}


/***/ }),

/***/ 64851:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const { dirname, join, resolve, relative, isAbsolute } = __nccwpck_require__(16928)
const fs = __nccwpck_require__(91943)

const pathExists = async path => {
  try {
    await fs.access(path)
    return true
  } catch (er) {
    return er.code !== 'ENOENT'
  }
}

const moveFile = async (source, destination, options = {}, root = true, symlinks = []) => {
  if (!source || !destination) {
    throw new TypeError('`source` and `destination` file required')
  }

  options = {
    overwrite: true,
    ...options,
  }

  if (!options.overwrite && await pathExists(destination)) {
    throw new Error(`The destination file exists: ${destination}`)
  }

  await fs.mkdir(dirname(destination), { recursive: true })

  try {
    await fs.rename(source, destination)
  } catch (error) {
    if (error.code === 'EXDEV' || error.code === 'EPERM') {
      const sourceStat = await fs.lstat(source)
      if (sourceStat.isDirectory()) {
        const files = await fs.readdir(source)
        await Promise.all(files.map((file) =>
          moveFile(join(source, file), join(destination, file), options, false, symlinks)
        ))
      } else if (sourceStat.isSymbolicLink()) {
        symlinks.push({ source, destination })
      } else {
        await fs.copyFile(source, destination)
      }
    } else {
      throw error
    }
  }

  if (root) {
    await Promise.all(symlinks.map(async ({ source: symSource, destination: symDestination }) => {
      let target = await fs.readlink(symSource)
      // junction symlinks in windows will be absolute paths, so we need to
      // make sure they point to the symlink destination
      if (isAbsolute(target)) {
        target = resolve(symDestination, relative(symSource, target))
      }
      // try to determine what the actual file is so we can create the correct
      // type of symlink in windows
      let targetStat = 'file'
      try {
        targetStat = await fs.stat(resolve(dirname(symSource), target))
        if (targetStat.isDirectory()) {
          targetStat = 'junction'
        }
      } catch {
        // targetStat remains 'file'
      }
      await fs.symlink(
        target,
        symDestination,
        targetStat
      )
    }))
    await fs.rm(source, { recursive: true, force: true })
  }
}

module.exports = moveFile


/***/ }),

/***/ 99367:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const { readdir } = __nccwpck_require__(91943)
const { join } = __nccwpck_require__(16928)

const readdirScoped = async (dir) => {
  const results = []

  for (const item of await readdir(dir)) {
    if (item.startsWith('@')) {
      for (const scopedItem of await readdir(join(dir, item))) {
        results.push(join(item, scopedItem))
      }
    } else {
      results.push(item)
    }
  }

  return results
}

module.exports = readdirScoped


/***/ }),

/***/ 16974:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const { join, sep } = __nccwpck_require__(16928)

const getOptions = __nccwpck_require__(84212)
const { mkdir, mkdtemp, rm } = __nccwpck_require__(91943)

// create a temp directory, ensure its permissions match its parent, then call
// the supplied function passing it the path to the directory. clean up after
// the function finishes, whether it throws or not
const withTempDir = async (root, fn, opts) => {
  const options = getOptions(opts, {
    copy: ['tmpPrefix'],
  })
  // create the directory
  await mkdir(root, { recursive: true })

  const target = await mkdtemp(join(`${root}${sep}`, options.tmpPrefix || ''))
  let err
  let result

  try {
    result = await fn(target)
  } catch (_err) {
    err = _err
  }

  try {
    await rm(target, { force: true, recursive: true })
  } catch {
    // ignore errors
  }

  if (err) {
    throw err
  }

  return result
}

module.exports = withTempDir


/***/ }),

/***/ 77864:
/***/ ((module) => {

"use strict";

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// pkg/dist-src/index.js
var dist_src_exports = {};
__export(dist_src_exports, {
  createTokenAuth: () => createTokenAuth
});
module.exports = __toCommonJS(dist_src_exports);

// pkg/dist-src/auth.js
var REGEX_IS_INSTALLATION_LEGACY = /^v1\./;
var REGEX_IS_INSTALLATION = /^ghs_/;
var REGEX_IS_USER_TO_SERVER = /^ghu_/;
async function auth(token) {
  const isApp = token.split(/\./).length === 3;
  const isInstallation = REGEX_IS_INSTALLATION_LEGACY.test(token) || REGEX_IS_INSTALLATION.test(token);
  const isUserToServer = REGEX_IS_USER_TO_SERVER.test(token);
  const tokenType = isApp ? "app" : isInstallation ? "installation" : isUserToServer ? "user-to-server" : "oauth";
  return {
    type: "token",
    token,
    tokenType
  };
}

// pkg/dist-src/with-authorization-prefix.js
function withAuthorizationPrefix(token) {
  if (token.split(/\./).length === 3) {
    return `bearer ${token}`;
  }
  return `token ${token}`;
}

// pkg/dist-src/hook.js
async function hook(token, request, route, parameters) {
  const endpoint = request.endpoint.merge(
    route,
    parameters
  );
  endpoint.headers.authorization = withAuthorizationPrefix(token);
  return request(endpoint);
}

// pkg/dist-src/index.js
var createTokenAuth = function createTokenAuth2(token) {
  if (!token) {
    throw new Error("[@octokit/auth-token] No token passed to createTokenAuth");
  }
  if (typeof token !== "string") {
    throw new Error(
      "[@octokit/auth-token] Token passed to createTokenAuth is not a string"
    );
  }
  token = token.replace(/^(token|bearer) +/i, "");
  return Object.assign(auth.bind(null, token), {
    hook: hook.bind(null, token)
  });
};
// Annotate the CommonJS export names for ESM import in node:
0 && (0);


/***/ }),

/***/ 61897:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// pkg/dist-src/index.js
var dist_src_exports = {};
__export(dist_src_exports, {
  Octokit: () => Octokit
});
module.exports = __toCommonJS(dist_src_exports);
var import_universal_user_agent = __nccwpck_require__(33843);
var import_before_after_hook = __nccwpck_require__(52732);
var import_request = __nccwpck_require__(66255);
var import_graphql = __nccwpck_require__(70007);
var import_auth_token = __nccwpck_require__(77864);

// pkg/dist-src/version.js
var VERSION = "5.1.0";

// pkg/dist-src/index.js
var noop = () => {
};
var consoleWarn = console.warn.bind(console);
var consoleError = console.error.bind(console);
var userAgentTrail = `octokit-core.js/${VERSION} ${(0, import_universal_user_agent.getUserAgent)()}`;
var Octokit = class {
  static {
    this.VERSION = VERSION;
  }
  static defaults(defaults) {
    const OctokitWithDefaults = class extends this {
      constructor(...args) {
        const options = args[0] || {};
        if (typeof defaults === "function") {
          super(defaults(options));
          return;
        }
        super(
          Object.assign(
            {},
            defaults,
            options,
            options.userAgent && defaults.userAgent ? {
              userAgent: `${options.userAgent} ${defaults.userAgent}`
            } : null
          )
        );
      }
    };
    return OctokitWithDefaults;
  }
  static {
    this.plugins = [];
  }
  /**
   * Attach a plugin (or many) to your Octokit instance.
   *
   * @example
   * const API = Octokit.plugin(plugin1, plugin2, plugin3, ...)
   */
  static plugin(...newPlugins) {
    const currentPlugins = this.plugins;
    const NewOctokit = class extends this {
      static {
        this.plugins = currentPlugins.concat(
          newPlugins.filter((plugin) => !currentPlugins.includes(plugin))
        );
      }
    };
    return NewOctokit;
  }
  constructor(options = {}) {
    const hook = new import_before_after_hook.Collection();
    const requestDefaults = {
      baseUrl: import_request.request.endpoint.DEFAULTS.baseUrl,
      headers: {},
      request: Object.assign({}, options.request, {
        // @ts-ignore internal usage only, no need to type
        hook: hook.bind(null, "request")
      }),
      mediaType: {
        previews: [],
        format: ""
      }
    };
    requestDefaults.headers["user-agent"] = options.userAgent ? `${options.userAgent} ${userAgentTrail}` : userAgentTrail;
    if (options.baseUrl) {
      requestDefaults.baseUrl = options.baseUrl;
    }
    if (options.previews) {
      requestDefaults.mediaType.previews = options.previews;
    }
    if (options.timeZone) {
      requestDefaults.headers["time-zone"] = options.timeZone;
    }
    this.request = import_request.request.defaults(requestDefaults);
    this.graphql = (0, import_graphql.withCustomRequest)(this.request).defaults(requestDefaults);
    this.log = Object.assign(
      {
        debug: noop,
        info: noop,
        warn: consoleWarn,
        error: consoleError
      },
      options.log
    );
    this.hook = hook;
    if (!options.authStrategy) {
      if (!options.auth) {
        this.auth = async () => ({
          type: "unauthenticated"
        });
      } else {
        const auth = (0, import_auth_token.createTokenAuth)(options.auth);
        hook.wrap("request", auth.hook);
        this.auth = auth;
      }
    } else {
      const { authStrategy, ...otherOptions } = options;
      const auth = authStrategy(
        Object.assign(
          {
            request: this.request,
            log: this.log,
            // we pass the current octokit instance as well as its constructor options
            // to allow for authentication strategies that return a new octokit instance
            // that shares the same internal state as the current one. The original
            // requirement for this was the "event-octokit" authentication strategy
            // of https://github.com/probot/octokit-auth-probot.
            octokit: this,
            octokitOptions: otherOptions
          },
          options.auth
        )
      );
      hook.wrap("request", auth.hook);
      this.auth = auth;
    }
    const classConstructor = this.constructor;
    for (let i = 0; i < classConstructor.plugins.length; ++i) {
      Object.assign(this, classConstructor.plugins[i](this, options));
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (0);


/***/ }),

/***/ 54471:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// pkg/dist-src/index.js
var dist_src_exports = {};
__export(dist_src_exports, {
  endpoint: () => endpoint
});
module.exports = __toCommonJS(dist_src_exports);

// pkg/dist-src/defaults.js
var import_universal_user_agent = __nccwpck_require__(33843);

// pkg/dist-src/version.js
var VERSION = "9.0.6";

// pkg/dist-src/defaults.js
var userAgent = `octokit-endpoint.js/${VERSION} ${(0, import_universal_user_agent.getUserAgent)()}`;
var DEFAULTS = {
  method: "GET",
  baseUrl: "https://api.github.com",
  headers: {
    accept: "application/vnd.github.v3+json",
    "user-agent": userAgent
  },
  mediaType: {
    format: ""
  }
};

// pkg/dist-src/util/lowercase-keys.js
function lowercaseKeys(object) {
  if (!object) {
    return {};
  }
  return Object.keys(object).reduce((newObj, key) => {
    newObj[key.toLowerCase()] = object[key];
    return newObj;
  }, {});
}

// pkg/dist-src/util/is-plain-object.js
function isPlainObject(value) {
  if (typeof value !== "object" || value === null)
    return false;
  if (Object.prototype.toString.call(value) !== "[object Object]")
    return false;
  const proto = Object.getPrototypeOf(value);
  if (proto === null)
    return true;
  const Ctor = Object.prototype.hasOwnProperty.call(proto, "constructor") && proto.constructor;
  return typeof Ctor === "function" && Ctor instanceof Ctor && Function.prototype.call(Ctor) === Function.prototype.call(value);
}

// pkg/dist-src/util/merge-deep.js
function mergeDeep(defaults, options) {
  const result = Object.assign({}, defaults);
  Object.keys(options).forEach((key) => {
    if (isPlainObject(options[key])) {
      if (!(key in defaults))
        Object.assign(result, { [key]: options[key] });
      else
        result[key] = mergeDeep(defaults[key], options[key]);
    } else {
      Object.assign(result, { [key]: options[key] });
    }
  });
  return result;
}

// pkg/dist-src/util/remove-undefined-properties.js
function removeUndefinedProperties(obj) {
  for (const key in obj) {
    if (obj[key] === void 0) {
      delete obj[key];
    }
  }
  return obj;
}

// pkg/dist-src/merge.js
function merge(defaults, route, options) {
  if (typeof route === "string") {
    let [method, url] = route.split(" ");
    options = Object.assign(url ? { method, url } : { url: method }, options);
  } else {
    options = Object.assign({}, route);
  }
  options.headers = lowercaseKeys(options.headers);
  removeUndefinedProperties(options);
  removeUndefinedProperties(options.headers);
  const mergedOptions = mergeDeep(defaults || {}, options);
  if (options.url === "/graphql") {
    if (defaults && defaults.mediaType.previews?.length) {
      mergedOptions.mediaType.previews = defaults.mediaType.previews.filter(
        (preview) => !mergedOptions.mediaType.previews.includes(preview)
      ).concat(mergedOptions.mediaType.previews);
    }
    mergedOptions.mediaType.previews = (mergedOptions.mediaType.previews || []).map((preview) => preview.replace(/-preview/, ""));
  }
  return mergedOptions;
}

// pkg/dist-src/util/add-query-parameters.js
function addQueryParameters(url, parameters) {
  const separator = /\?/.test(url) ? "&" : "?";
  const names = Object.keys(parameters);
  if (names.length === 0) {
    return url;
  }
  return url + separator + names.map((name) => {
    if (name === "q") {
      return "q=" + parameters.q.split("+").map(encodeURIComponent).join("+");
    }
    return `${name}=${encodeURIComponent(parameters[name])}`;
  }).join("&");
}

// pkg/dist-src/util/extract-url-variable-names.js
var urlVariableRegex = /\{[^{}}]+\}/g;
function removeNonChars(variableName) {
  return variableName.replace(/(?:^\W+)|(?:(?<!\W)\W+$)/g, "").split(/,/);
}
function extractUrlVariableNames(url) {
  const matches = url.match(urlVariableRegex);
  if (!matches) {
    return [];
  }
  return matches.map(removeNonChars).reduce((a, b) => a.concat(b), []);
}

// pkg/dist-src/util/omit.js
function omit(object, keysToOmit) {
  const result = { __proto__: null };
  for (const key of Object.keys(object)) {
    if (keysToOmit.indexOf(key) === -1) {
      result[key] = object[key];
    }
  }
  return result;
}

// pkg/dist-src/util/url-template.js
function encodeReserved(str) {
  return str.split(/(%[0-9A-Fa-f]{2})/g).map(function(part) {
    if (!/%[0-9A-Fa-f]/.test(part)) {
      part = encodeURI(part).replace(/%5B/g, "[").replace(/%5D/g, "]");
    }
    return part;
  }).join("");
}
function encodeUnreserved(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
    return "%" + c.charCodeAt(0).toString(16).toUpperCase();
  });
}
function encodeValue(operator, value, key) {
  value = operator === "+" || operator === "#" ? encodeReserved(value) : encodeUnreserved(value);
  if (key) {
    return encodeUnreserved(key) + "=" + value;
  } else {
    return value;
  }
}
function isDefined(value) {
  return value !== void 0 && value !== null;
}
function isKeyOperator(operator) {
  return operator === ";" || operator === "&" || operator === "?";
}
function getValues(context, operator, key, modifier) {
  var value = context[key], result = [];
  if (isDefined(value) && value !== "") {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      value = value.toString();
      if (modifier && modifier !== "*") {
        value = value.substring(0, parseInt(modifier, 10));
      }
      result.push(
        encodeValue(operator, value, isKeyOperator(operator) ? key : "")
      );
    } else {
      if (modifier === "*") {
        if (Array.isArray(value)) {
          value.filter(isDefined).forEach(function(value2) {
            result.push(
              encodeValue(operator, value2, isKeyOperator(operator) ? key : "")
            );
          });
        } else {
          Object.keys(value).forEach(function(k) {
            if (isDefined(value[k])) {
              result.push(encodeValue(operator, value[k], k));
            }
          });
        }
      } else {
        const tmp = [];
        if (Array.isArray(value)) {
          value.filter(isDefined).forEach(function(value2) {
            tmp.push(encodeValue(operator, value2));
          });
        } else {
          Object.keys(value).forEach(function(k) {
            if (isDefined(value[k])) {
              tmp.push(encodeUnreserved(k));
              tmp.push(encodeValue(operator, value[k].toString()));
            }
          });
        }
        if (isKeyOperator(operator)) {
          result.push(encodeUnreserved(key) + "=" + tmp.join(","));
        } else if (tmp.length !== 0) {
          result.push(tmp.join(","));
        }
      }
    }
  } else {
    if (operator === ";") {
      if (isDefined(value)) {
        result.push(encodeUnreserved(key));
      }
    } else if (value === "" && (operator === "&" || operator === "?")) {
      result.push(encodeUnreserved(key) + "=");
    } else if (value === "") {
      result.push("");
    }
  }
  return result;
}
function parseUrl(template) {
  return {
    expand: expand.bind(null, template)
  };
}
function expand(template, context) {
  var operators = ["+", "#", ".", "/", ";", "?", "&"];
  template = template.replace(
    /\{([^\{\}]+)\}|([^\{\}]+)/g,
    function(_, expression, literal) {
      if (expression) {
        let operator = "";
        const values = [];
        if (operators.indexOf(expression.charAt(0)) !== -1) {
          operator = expression.charAt(0);
          expression = expression.substr(1);
        }
        expression.split(/,/g).forEach(function(variable) {
          var tmp = /([^:\*]*)(?::(\d+)|(\*))?/.exec(variable);
          values.push(getValues(context, operator, tmp[1], tmp[2] || tmp[3]));
        });
        if (operator && operator !== "+") {
          var separator = ",";
          if (operator === "?") {
            separator = "&";
          } else if (operator !== "#") {
            separator = operator;
          }
          return (values.length !== 0 ? operator : "") + values.join(separator);
        } else {
          return values.join(",");
        }
      } else {
        return encodeReserved(literal);
      }
    }
  );
  if (template === "/") {
    return template;
  } else {
    return template.replace(/\/$/, "");
  }
}

// pkg/dist-src/parse.js
function parse(options) {
  let method = options.method.toUpperCase();
  let url = (options.url || "/").replace(/:([a-z]\w+)/g, "{$1}");
  let headers = Object.assign({}, options.headers);
  let body;
  let parameters = omit(options, [
    "method",
    "baseUrl",
    "url",
    "headers",
    "request",
    "mediaType"
  ]);
  const urlVariableNames = extractUrlVariableNames(url);
  url = parseUrl(url).expand(parameters);
  if (!/^http/.test(url)) {
    url = options.baseUrl + url;
  }
  const omittedParameters = Object.keys(options).filter((option) => urlVariableNames.includes(option)).concat("baseUrl");
  const remainingParameters = omit(parameters, omittedParameters);
  const isBinaryRequest = /application\/octet-stream/i.test(headers.accept);
  if (!isBinaryRequest) {
    if (options.mediaType.format) {
      headers.accept = headers.accept.split(/,/).map(
        (format) => format.replace(
          /application\/vnd(\.\w+)(\.v3)?(\.\w+)?(\+json)?$/,
          `application/vnd$1$2.${options.mediaType.format}`
        )
      ).join(",");
    }
    if (url.endsWith("/graphql")) {
      if (options.mediaType.previews?.length) {
        const previewsFromAcceptHeader = headers.accept.match(/(?<![\w-])[\w-]+(?=-preview)/g) || [];
        headers.accept = previewsFromAcceptHeader.concat(options.mediaType.previews).map((preview) => {
          const format = options.mediaType.format ? `.${options.mediaType.format}` : "+json";
          return `application/vnd.github.${preview}-preview${format}`;
        }).join(",");
      }
    }
  }
  if (["GET", "HEAD"].includes(method)) {
    url = addQueryParameters(url, remainingParameters);
  } else {
    if ("data" in remainingParameters) {
      body = remainingParameters.data;
    } else {
      if (Object.keys(remainingParameters).length) {
        body = remainingParameters;
      }
    }
  }
  if (!headers["content-type"] && typeof body !== "undefined") {
    headers["content-type"] = "application/json; charset=utf-8";
  }
  if (["PATCH", "PUT"].includes(method) && typeof body === "undefined") {
    body = "";
  }
  return Object.assign(
    { method, url, headers },
    typeof body !== "undefined" ? { body } : null,
    options.request ? { request: options.request } : null
  );
}

// pkg/dist-src/endpoint-with-defaults.js
function endpointWithDefaults(defaults, route, options) {
  return parse(merge(defaults, route, options));
}

// pkg/dist-src/with-defaults.js
function withDefaults(oldDefaults, newDefaults) {
  const DEFAULTS2 = merge(oldDefaults, newDefaults);
  const endpoint2 = endpointWithDefaults.bind(null, DEFAULTS2);
  return Object.assign(endpoint2, {
    DEFAULTS: DEFAULTS2,
    defaults: withDefaults.bind(null, DEFAULTS2),
    merge: merge.bind(null, DEFAULTS2),
    parse
  });
}

// pkg/dist-src/index.js
var endpoint = withDefaults(null, DEFAULTS);
// Annotate the CommonJS export names for ESM import in node:
0 && (0);


/***/ }),

/***/ 70007:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// pkg/dist-src/index.js
var dist_src_exports = {};
__export(dist_src_exports, {
  GraphqlResponseError: () => GraphqlResponseError,
  graphql: () => graphql2,
  withCustomRequest: () => withCustomRequest
});
module.exports = __toCommonJS(dist_src_exports);
var import_request3 = __nccwpck_require__(66255);
var import_universal_user_agent = __nccwpck_require__(33843);

// pkg/dist-src/version.js
var VERSION = "7.0.2";

// pkg/dist-src/with-defaults.js
var import_request2 = __nccwpck_require__(66255);

// pkg/dist-src/graphql.js
var import_request = __nccwpck_require__(66255);

// pkg/dist-src/error.js
function _buildMessageForResponseErrors(data) {
  return `Request failed due to following response errors:
` + data.errors.map((e) => ` - ${e.message}`).join("\n");
}
var GraphqlResponseError = class extends Error {
  constructor(request2, headers, response) {
    super(_buildMessageForResponseErrors(response));
    this.request = request2;
    this.headers = headers;
    this.response = response;
    this.name = "GraphqlResponseError";
    this.errors = response.errors;
    this.data = response.data;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
};

// pkg/dist-src/graphql.js
var NON_VARIABLE_OPTIONS = [
  "method",
  "baseUrl",
  "url",
  "headers",
  "request",
  "query",
  "mediaType"
];
var FORBIDDEN_VARIABLE_OPTIONS = ["query", "method", "url"];
var GHES_V3_SUFFIX_REGEX = /\/api\/v3\/?$/;
function graphql(request2, query, options) {
  if (options) {
    if (typeof query === "string" && "query" in options) {
      return Promise.reject(
        new Error(`[@octokit/graphql] "query" cannot be used as variable name`)
      );
    }
    for (const key in options) {
      if (!FORBIDDEN_VARIABLE_OPTIONS.includes(key))
        continue;
      return Promise.reject(
        new Error(
          `[@octokit/graphql] "${key}" cannot be used as variable name`
        )
      );
    }
  }
  const parsedOptions = typeof query === "string" ? Object.assign({ query }, options) : query;
  const requestOptions = Object.keys(
    parsedOptions
  ).reduce((result, key) => {
    if (NON_VARIABLE_OPTIONS.includes(key)) {
      result[key] = parsedOptions[key];
      return result;
    }
    if (!result.variables) {
      result.variables = {};
    }
    result.variables[key] = parsedOptions[key];
    return result;
  }, {});
  const baseUrl = parsedOptions.baseUrl || request2.endpoint.DEFAULTS.baseUrl;
  if (GHES_V3_SUFFIX_REGEX.test(baseUrl)) {
    requestOptions.url = baseUrl.replace(GHES_V3_SUFFIX_REGEX, "/api/graphql");
  }
  return request2(requestOptions).then((response) => {
    if (response.data.errors) {
      const headers = {};
      for (const key of Object.keys(response.headers)) {
        headers[key] = response.headers[key];
      }
      throw new GraphqlResponseError(
        requestOptions,
        headers,
        response.data
      );
    }
    return response.data.data;
  });
}

// pkg/dist-src/with-defaults.js
function withDefaults(request2, newDefaults) {
  const newRequest = request2.defaults(newDefaults);
  const newApi = (query, options) => {
    return graphql(newRequest, query, options);
  };
  return Object.assign(newApi, {
    defaults: withDefaults.bind(null, newRequest),
    endpoint: newRequest.endpoint
  });
}

// pkg/dist-src/index.js
var graphql2 = withDefaults(import_request3.request, {
  headers: {
    "user-agent": `octokit-graphql.js/${VERSION} ${(0, import_universal_user_agent.getUserAgent)()}`
  },
  method: "POST",
  url: "/graphql"
});
function withCustomRequest(customRequest) {
  return withDefaults(customRequest, {
    method: "POST",
    url: "/graphql"
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (0);


/***/ }),

/***/ 38082:
/***/ ((module) => {

"use strict";

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// pkg/dist-src/index.js
var dist_src_exports = {};
__export(dist_src_exports, {
  composePaginateRest: () => composePaginateRest,
  isPaginatingEndpoint: () => isPaginatingEndpoint,
  paginateRest: () => paginateRest,
  paginatingEndpoints: () => paginatingEndpoints
});
module.exports = __toCommonJS(dist_src_exports);

// pkg/dist-src/version.js
var VERSION = "9.2.2";

// pkg/dist-src/normalize-paginated-list-response.js
function normalizePaginatedListResponse(response) {
  if (!response.data) {
    return {
      ...response,
      data: []
    };
  }
  const responseNeedsNormalization = "total_count" in response.data && !("url" in response.data);
  if (!responseNeedsNormalization)
    return response;
  const incompleteResults = response.data.incomplete_results;
  const repositorySelection = response.data.repository_selection;
  const totalCount = response.data.total_count;
  delete response.data.incomplete_results;
  delete response.data.repository_selection;
  delete response.data.total_count;
  const namespaceKey = Object.keys(response.data)[0];
  const data = response.data[namespaceKey];
  response.data = data;
  if (typeof incompleteResults !== "undefined") {
    response.data.incomplete_results = incompleteResults;
  }
  if (typeof repositorySelection !== "undefined") {
    response.data.repository_selection = repositorySelection;
  }
  response.data.total_count = totalCount;
  return response;
}

// pkg/dist-src/iterator.js
function iterator(octokit, route, parameters) {
  const options = typeof route === "function" ? route.endpoint(parameters) : octokit.request.endpoint(route, parameters);
  const requestMethod = typeof route === "function" ? route : octokit.request;
  const method = options.method;
  const headers = options.headers;
  let url = options.url;
  return {
    [Symbol.asyncIterator]: () => ({
      async next() {
        if (!url)
          return { done: true };
        try {
          const response = await requestMethod({ method, url, headers });
          const normalizedResponse = normalizePaginatedListResponse(response);
          url = ((normalizedResponse.headers.link || "").match(
            /<([^<>]+)>;\s*rel="next"/
          ) || [])[1];
          return { value: normalizedResponse };
        } catch (error) {
          if (error.status !== 409)
            throw error;
          url = "";
          return {
            value: {
              status: 200,
              headers: {},
              data: []
            }
          };
        }
      }
    })
  };
}

// pkg/dist-src/paginate.js
function paginate(octokit, route, parameters, mapFn) {
  if (typeof parameters === "function") {
    mapFn = parameters;
    parameters = void 0;
  }
  return gather(
    octokit,
    [],
    iterator(octokit, route, parameters)[Symbol.asyncIterator](),
    mapFn
  );
}
function gather(octokit, results, iterator2, mapFn) {
  return iterator2.next().then((result) => {
    if (result.done) {
      return results;
    }
    let earlyExit = false;
    function done() {
      earlyExit = true;
    }
    results = results.concat(
      mapFn ? mapFn(result.value, done) : result.value.data
    );
    if (earlyExit) {
      return results;
    }
    return gather(octokit, results, iterator2, mapFn);
  });
}

// pkg/dist-src/compose-paginate.js
var composePaginateRest = Object.assign(paginate, {
  iterator
});

// pkg/dist-src/generated/paginating-endpoints.js
var paginatingEndpoints = [
  "GET /advisories",
  "GET /app/hook/deliveries",
  "GET /app/installation-requests",
  "GET /app/installations",
  "GET /assignments/{assignment_id}/accepted_assignments",
  "GET /classrooms",
  "GET /classrooms/{classroom_id}/assignments",
  "GET /enterprises/{enterprise}/dependabot/alerts",
  "GET /enterprises/{enterprise}/secret-scanning/alerts",
  "GET /events",
  "GET /gists",
  "GET /gists/public",
  "GET /gists/starred",
  "GET /gists/{gist_id}/comments",
  "GET /gists/{gist_id}/commits",
  "GET /gists/{gist_id}/forks",
  "GET /installation/repositories",
  "GET /issues",
  "GET /licenses",
  "GET /marketplace_listing/plans",
  "GET /marketplace_listing/plans/{plan_id}/accounts",
  "GET /marketplace_listing/stubbed/plans",
  "GET /marketplace_listing/stubbed/plans/{plan_id}/accounts",
  "GET /networks/{owner}/{repo}/events",
  "GET /notifications",
  "GET /organizations",
  "GET /orgs/{org}/actions/cache/usage-by-repository",
  "GET /orgs/{org}/actions/permissions/repositories",
  "GET /orgs/{org}/actions/runners",
  "GET /orgs/{org}/actions/secrets",
  "GET /orgs/{org}/actions/secrets/{secret_name}/repositories",
  "GET /orgs/{org}/actions/variables",
  "GET /orgs/{org}/actions/variables/{name}/repositories",
  "GET /orgs/{org}/blocks",
  "GET /orgs/{org}/code-scanning/alerts",
  "GET /orgs/{org}/codespaces",
  "GET /orgs/{org}/codespaces/secrets",
  "GET /orgs/{org}/codespaces/secrets/{secret_name}/repositories",
  "GET /orgs/{org}/copilot/billing/seats",
  "GET /orgs/{org}/dependabot/alerts",
  "GET /orgs/{org}/dependabot/secrets",
  "GET /orgs/{org}/dependabot/secrets/{secret_name}/repositories",
  "GET /orgs/{org}/events",
  "GET /orgs/{org}/failed_invitations",
  "GET /orgs/{org}/hooks",
  "GET /orgs/{org}/hooks/{hook_id}/deliveries",
  "GET /orgs/{org}/installations",
  "GET /orgs/{org}/invitations",
  "GET /orgs/{org}/invitations/{invitation_id}/teams",
  "GET /orgs/{org}/issues",
  "GET /orgs/{org}/members",
  "GET /orgs/{org}/members/{username}/codespaces",
  "GET /orgs/{org}/migrations",
  "GET /orgs/{org}/migrations/{migration_id}/repositories",
  "GET /orgs/{org}/organization-roles/{role_id}/teams",
  "GET /orgs/{org}/organization-roles/{role_id}/users",
  "GET /orgs/{org}/outside_collaborators",
  "GET /orgs/{org}/packages",
  "GET /orgs/{org}/packages/{package_type}/{package_name}/versions",
  "GET /orgs/{org}/personal-access-token-requests",
  "GET /orgs/{org}/personal-access-token-requests/{pat_request_id}/repositories",
  "GET /orgs/{org}/personal-access-tokens",
  "GET /orgs/{org}/personal-access-tokens/{pat_id}/repositories",
  "GET /orgs/{org}/projects",
  "GET /orgs/{org}/properties/values",
  "GET /orgs/{org}/public_members",
  "GET /orgs/{org}/repos",
  "GET /orgs/{org}/rulesets",
  "GET /orgs/{org}/rulesets/rule-suites",
  "GET /orgs/{org}/secret-scanning/alerts",
  "GET /orgs/{org}/security-advisories",
  "GET /orgs/{org}/teams",
  "GET /orgs/{org}/teams/{team_slug}/discussions",
  "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments",
  "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions",
  "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions",
  "GET /orgs/{org}/teams/{team_slug}/invitations",
  "GET /orgs/{org}/teams/{team_slug}/members",
  "GET /orgs/{org}/teams/{team_slug}/projects",
  "GET /orgs/{org}/teams/{team_slug}/repos",
  "GET /orgs/{org}/teams/{team_slug}/teams",
  "GET /projects/columns/{column_id}/cards",
  "GET /projects/{project_id}/collaborators",
  "GET /projects/{project_id}/columns",
  "GET /repos/{owner}/{repo}/actions/artifacts",
  "GET /repos/{owner}/{repo}/actions/caches",
  "GET /repos/{owner}/{repo}/actions/organization-secrets",
  "GET /repos/{owner}/{repo}/actions/organization-variables",
  "GET /repos/{owner}/{repo}/actions/runners",
  "GET /repos/{owner}/{repo}/actions/runs",
  "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
  "GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/jobs",
  "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs",
  "GET /repos/{owner}/{repo}/actions/secrets",
  "GET /repos/{owner}/{repo}/actions/variables",
  "GET /repos/{owner}/{repo}/actions/workflows",
  "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs",
  "GET /repos/{owner}/{repo}/activity",
  "GET /repos/{owner}/{repo}/assignees",
  "GET /repos/{owner}/{repo}/branches",
  "GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations",
  "GET /repos/{owner}/{repo}/check-suites/{check_suite_id}/check-runs",
  "GET /repos/{owner}/{repo}/code-scanning/alerts",
  "GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/instances",
  "GET /repos/{owner}/{repo}/code-scanning/analyses",
  "GET /repos/{owner}/{repo}/codespaces",
  "GET /repos/{owner}/{repo}/codespaces/devcontainers",
  "GET /repos/{owner}/{repo}/codespaces/secrets",
  "GET /repos/{owner}/{repo}/collaborators",
  "GET /repos/{owner}/{repo}/comments",
  "GET /repos/{owner}/{repo}/comments/{comment_id}/reactions",
  "GET /repos/{owner}/{repo}/commits",
  "GET /repos/{owner}/{repo}/commits/{commit_sha}/comments",
  "GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls",
  "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
  "GET /repos/{owner}/{repo}/commits/{ref}/check-suites",
  "GET /repos/{owner}/{repo}/commits/{ref}/status",
  "GET /repos/{owner}/{repo}/commits/{ref}/statuses",
  "GET /repos/{owner}/{repo}/contributors",
  "GET /repos/{owner}/{repo}/dependabot/alerts",
  "GET /repos/{owner}/{repo}/dependabot/secrets",
  "GET /repos/{owner}/{repo}/deployments",
  "GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses",
  "GET /repos/{owner}/{repo}/environments",
  "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies",
  "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/apps",
  "GET /repos/{owner}/{repo}/events",
  "GET /repos/{owner}/{repo}/forks",
  "GET /repos/{owner}/{repo}/hooks",
  "GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries",
  "GET /repos/{owner}/{repo}/invitations",
  "GET /repos/{owner}/{repo}/issues",
  "GET /repos/{owner}/{repo}/issues/comments",
  "GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions",
  "GET /repos/{owner}/{repo}/issues/events",
  "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
  "GET /repos/{owner}/{repo}/issues/{issue_number}/events",
  "GET /repos/{owner}/{repo}/issues/{issue_number}/labels",
  "GET /repos/{owner}/{repo}/issues/{issue_number}/reactions",
  "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline",
  "GET /repos/{owner}/{repo}/keys",
  "GET /repos/{owner}/{repo}/labels",
  "GET /repos/{owner}/{repo}/milestones",
  "GET /repos/{owner}/{repo}/milestones/{milestone_number}/labels",
  "GET /repos/{owner}/{repo}/notifications",
  "GET /repos/{owner}/{repo}/pages/builds",
  "GET /repos/{owner}/{repo}/projects",
  "GET /repos/{owner}/{repo}/pulls",
  "GET /repos/{owner}/{repo}/pulls/comments",
  "GET /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions",
  "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments",
  "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits",
  "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
  "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
  "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments",
  "GET /repos/{owner}/{repo}/releases",
  "GET /repos/{owner}/{repo}/releases/{release_id}/assets",
  "GET /repos/{owner}/{repo}/releases/{release_id}/reactions",
  "GET /repos/{owner}/{repo}/rules/branches/{branch}",
  "GET /repos/{owner}/{repo}/rulesets",
  "GET /repos/{owner}/{repo}/rulesets/rule-suites",
  "GET /repos/{owner}/{repo}/secret-scanning/alerts",
  "GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}/locations",
  "GET /repos/{owner}/{repo}/security-advisories",
  "GET /repos/{owner}/{repo}/stargazers",
  "GET /repos/{owner}/{repo}/subscribers",
  "GET /repos/{owner}/{repo}/tags",
  "GET /repos/{owner}/{repo}/teams",
  "GET /repos/{owner}/{repo}/topics",
  "GET /repositories",
  "GET /repositories/{repository_id}/environments/{environment_name}/secrets",
  "GET /repositories/{repository_id}/environments/{environment_name}/variables",
  "GET /search/code",
  "GET /search/commits",
  "GET /search/issues",
  "GET /search/labels",
  "GET /search/repositories",
  "GET /search/topics",
  "GET /search/users",
  "GET /teams/{team_id}/discussions",
  "GET /teams/{team_id}/discussions/{discussion_number}/comments",
  "GET /teams/{team_id}/discussions/{discussion_number}/comments/{comment_number}/reactions",
  "GET /teams/{team_id}/discussions/{discussion_number}/reactions",
  "GET /teams/{team_id}/invitations",
  "GET /teams/{team_id}/members",
  "GET /teams/{team_id}/projects",
  "GET /teams/{team_id}/repos",
  "GET /teams/{team_id}/teams",
  "GET /user/blocks",
  "GET /user/codespaces",
  "GET /user/codespaces/secrets",
  "GET /user/emails",
  "GET /user/followers",
  "GET /user/following",
  "GET /user/gpg_keys",
  "GET /user/installations",
  "GET /user/installations/{installation_id}/repositories",
  "GET /user/issues",
  "GET /user/keys",
  "GET /user/marketplace_purchases",
  "GET /user/marketplace_purchases/stubbed",
  "GET /user/memberships/orgs",
  "GET /user/migrations",
  "GET /user/migrations/{migration_id}/repositories",
  "GET /user/orgs",
  "GET /user/packages",
  "GET /user/packages/{package_type}/{package_name}/versions",
  "GET /user/public_emails",
  "GET /user/repos",
  "GET /user/repository_invitations",
  "GET /user/social_accounts",
  "GET /user/ssh_signing_keys",
  "GET /user/starred",
  "GET /user/subscriptions",
  "GET /user/teams",
  "GET /users",
  "GET /users/{username}/events",
  "GET /users/{username}/events/orgs/{org}",
  "GET /users/{username}/events/public",
  "GET /users/{username}/followers",
  "GET /users/{username}/following",
  "GET /users/{username}/gists",
  "GET /users/{username}/gpg_keys",
  "GET /users/{username}/keys",
  "GET /users/{username}/orgs",
  "GET /users/{username}/packages",
  "GET /users/{username}/projects",
  "GET /users/{username}/received_events",
  "GET /users/{username}/received_events/public",
  "GET /users/{username}/repos",
  "GET /users/{username}/social_accounts",
  "GET /users/{username}/ssh_signing_keys",
  "GET /users/{username}/starred",
  "GET /users/{username}/subscriptions"
];

// pkg/dist-src/paginating-endpoints.js
function isPaginatingEndpoint(arg) {
  if (typeof arg === "string") {
    return paginatingEndpoints.includes(arg);
  } else {
    return false;
  }
}

// pkg/dist-src/index.js
function paginateRest(octokit) {
  return {
    paginate: Object.assign(paginate.bind(null, octokit), {
      iterator: iterator.bind(null, octokit)
    })
  };
}
paginateRest.VERSION = VERSION;
// Annotate the CommonJS export names for ESM import in node:
0 && (0);


/***/ }),

/***/ 84935:
/***/ ((module) => {

"use strict";

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// pkg/dist-src/index.js
var dist_src_exports = {};
__export(dist_src_exports, {
  legacyRestEndpointMethods: () => legacyRestEndpointMethods,
  restEndpointMethods: () => restEndpointMethods
});
module.exports = __toCommonJS(dist_src_exports);

// pkg/dist-src/version.js
var VERSION = "10.4.1";

// pkg/dist-src/generated/endpoints.js
var Endpoints = {
  actions: {
    addCustomLabelsToSelfHostedRunnerForOrg: [
      "POST /orgs/{org}/actions/runners/{runner_id}/labels"
    ],
    addCustomLabelsToSelfHostedRunnerForRepo: [
      "POST /repos/{owner}/{repo}/actions/runners/{runner_id}/labels"
    ],
    addSelectedRepoToOrgSecret: [
      "PUT /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}"
    ],
    addSelectedRepoToOrgVariable: [
      "PUT /orgs/{org}/actions/variables/{name}/repositories/{repository_id}"
    ],
    approveWorkflowRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/approve"
    ],
    cancelWorkflowRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel"
    ],
    createEnvironmentVariable: [
      "POST /repositories/{repository_id}/environments/{environment_name}/variables"
    ],
    createOrUpdateEnvironmentSecret: [
      "PUT /repositories/{repository_id}/environments/{environment_name}/secrets/{secret_name}"
    ],
    createOrUpdateOrgSecret: ["PUT /orgs/{org}/actions/secrets/{secret_name}"],
    createOrUpdateRepoSecret: [
      "PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}"
    ],
    createOrgVariable: ["POST /orgs/{org}/actions/variables"],
    createRegistrationTokenForOrg: [
      "POST /orgs/{org}/actions/runners/registration-token"
    ],
    createRegistrationTokenForRepo: [
      "POST /repos/{owner}/{repo}/actions/runners/registration-token"
    ],
    createRemoveTokenForOrg: ["POST /orgs/{org}/actions/runners/remove-token"],
    createRemoveTokenForRepo: [
      "POST /repos/{owner}/{repo}/actions/runners/remove-token"
    ],
    createRepoVariable: ["POST /repos/{owner}/{repo}/actions/variables"],
    createWorkflowDispatch: [
      "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches"
    ],
    deleteActionsCacheById: [
      "DELETE /repos/{owner}/{repo}/actions/caches/{cache_id}"
    ],
    deleteActionsCacheByKey: [
      "DELETE /repos/{owner}/{repo}/actions/caches{?key,ref}"
    ],
    deleteArtifact: [
      "DELETE /repos/{owner}/{repo}/actions/artifacts/{artifact_id}"
    ],
    deleteEnvironmentSecret: [
      "DELETE /repositories/{repository_id}/environments/{environment_name}/secrets/{secret_name}"
    ],
    deleteEnvironmentVariable: [
      "DELETE /repositories/{repository_id}/environments/{environment_name}/variables/{name}"
    ],
    deleteOrgSecret: ["DELETE /orgs/{org}/actions/secrets/{secret_name}"],
    deleteOrgVariable: ["DELETE /orgs/{org}/actions/variables/{name}"],
    deleteRepoSecret: [
      "DELETE /repos/{owner}/{repo}/actions/secrets/{secret_name}"
    ],
    deleteRepoVariable: [
      "DELETE /repos/{owner}/{repo}/actions/variables/{name}"
    ],
    deleteSelfHostedRunnerFromOrg: [
      "DELETE /orgs/{org}/actions/runners/{runner_id}"
    ],
    deleteSelfHostedRunnerFromRepo: [
      "DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}"
    ],
    deleteWorkflowRun: ["DELETE /repos/{owner}/{repo}/actions/runs/{run_id}"],
    deleteWorkflowRunLogs: [
      "DELETE /repos/{owner}/{repo}/actions/runs/{run_id}/logs"
    ],
    disableSelectedRepositoryGithubActionsOrganization: [
      "DELETE /orgs/{org}/actions/permissions/repositories/{repository_id}"
    ],
    disableWorkflow: [
      "PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/disable"
    ],
    downloadArtifact: [
      "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}"
    ],
    downloadJobLogsForWorkflowRun: [
      "GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs"
    ],
    downloadWorkflowRunAttemptLogs: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/logs"
    ],
    downloadWorkflowRunLogs: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs"
    ],
    enableSelectedRepositoryGithubActionsOrganization: [
      "PUT /orgs/{org}/actions/permissions/repositories/{repository_id}"
    ],
    enableWorkflow: [
      "PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/enable"
    ],
    forceCancelWorkflowRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/force-cancel"
    ],
    generateRunnerJitconfigForOrg: [
      "POST /orgs/{org}/actions/runners/generate-jitconfig"
    ],
    generateRunnerJitconfigForRepo: [
      "POST /repos/{owner}/{repo}/actions/runners/generate-jitconfig"
    ],
    getActionsCacheList: ["GET /repos/{owner}/{repo}/actions/caches"],
    getActionsCacheUsage: ["GET /repos/{owner}/{repo}/actions/cache/usage"],
    getActionsCacheUsageByRepoForOrg: [
      "GET /orgs/{org}/actions/cache/usage-by-repository"
    ],
    getActionsCacheUsageForOrg: ["GET /orgs/{org}/actions/cache/usage"],
    getAllowedActionsOrganization: [
      "GET /orgs/{org}/actions/permissions/selected-actions"
    ],
    getAllowedActionsRepository: [
      "GET /repos/{owner}/{repo}/actions/permissions/selected-actions"
    ],
    getArtifact: ["GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}"],
    getCustomOidcSubClaimForRepo: [
      "GET /repos/{owner}/{repo}/actions/oidc/customization/sub"
    ],
    getEnvironmentPublicKey: [
      "GET /repositories/{repository_id}/environments/{environment_name}/secrets/public-key"
    ],
    getEnvironmentSecret: [
      "GET /repositories/{repository_id}/environments/{environment_name}/secrets/{secret_name}"
    ],
    getEnvironmentVariable: [
      "GET /repositories/{repository_id}/environments/{environment_name}/variables/{name}"
    ],
    getGithubActionsDefaultWorkflowPermissionsOrganization: [
      "GET /orgs/{org}/actions/permissions/workflow"
    ],
    getGithubActionsDefaultWorkflowPermissionsRepository: [
      "GET /repos/{owner}/{repo}/actions/permissions/workflow"
    ],
    getGithubActionsPermissionsOrganization: [
      "GET /orgs/{org}/actions/permissions"
    ],
    getGithubActionsPermissionsRepository: [
      "GET /repos/{owner}/{repo}/actions/permissions"
    ],
    getJobForWorkflowRun: ["GET /repos/{owner}/{repo}/actions/jobs/{job_id}"],
    getOrgPublicKey: ["GET /orgs/{org}/actions/secrets/public-key"],
    getOrgSecret: ["GET /orgs/{org}/actions/secrets/{secret_name}"],
    getOrgVariable: ["GET /orgs/{org}/actions/variables/{name}"],
    getPendingDeploymentsForRun: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments"
    ],
    getRepoPermissions: [
      "GET /repos/{owner}/{repo}/actions/permissions",
      {},
      { renamed: ["actions", "getGithubActionsPermissionsRepository"] }
    ],
    getRepoPublicKey: ["GET /repos/{owner}/{repo}/actions/secrets/public-key"],
    getRepoSecret: ["GET /repos/{owner}/{repo}/actions/secrets/{secret_name}"],
    getRepoVariable: ["GET /repos/{owner}/{repo}/actions/variables/{name}"],
    getReviewsForRun: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/approvals"
    ],
    getSelfHostedRunnerForOrg: ["GET /orgs/{org}/actions/runners/{runner_id}"],
    getSelfHostedRunnerForRepo: [
      "GET /repos/{owner}/{repo}/actions/runners/{runner_id}"
    ],
    getWorkflow: ["GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}"],
    getWorkflowAccessToRepository: [
      "GET /repos/{owner}/{repo}/actions/permissions/access"
    ],
    getWorkflowRun: ["GET /repos/{owner}/{repo}/actions/runs/{run_id}"],
    getWorkflowRunAttempt: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}"
    ],
    getWorkflowRunUsage: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/timing"
    ],
    getWorkflowUsage: [
      "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/timing"
    ],
    listArtifactsForRepo: ["GET /repos/{owner}/{repo}/actions/artifacts"],
    listEnvironmentSecrets: [
      "GET /repositories/{repository_id}/environments/{environment_name}/secrets"
    ],
    listEnvironmentVariables: [
      "GET /repositories/{repository_id}/environments/{environment_name}/variables"
    ],
    listJobsForWorkflowRun: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs"
    ],
    listJobsForWorkflowRunAttempt: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/jobs"
    ],
    listLabelsForSelfHostedRunnerForOrg: [
      "GET /orgs/{org}/actions/runners/{runner_id}/labels"
    ],
    listLabelsForSelfHostedRunnerForRepo: [
      "GET /repos/{owner}/{repo}/actions/runners/{runner_id}/labels"
    ],
    listOrgSecrets: ["GET /orgs/{org}/actions/secrets"],
    listOrgVariables: ["GET /orgs/{org}/actions/variables"],
    listRepoOrganizationSecrets: [
      "GET /repos/{owner}/{repo}/actions/organization-secrets"
    ],
    listRepoOrganizationVariables: [
      "GET /repos/{owner}/{repo}/actions/organization-variables"
    ],
    listRepoSecrets: ["GET /repos/{owner}/{repo}/actions/secrets"],
    listRepoVariables: ["GET /repos/{owner}/{repo}/actions/variables"],
    listRepoWorkflows: ["GET /repos/{owner}/{repo}/actions/workflows"],
    listRunnerApplicationsForOrg: ["GET /orgs/{org}/actions/runners/downloads"],
    listRunnerApplicationsForRepo: [
      "GET /repos/{owner}/{repo}/actions/runners/downloads"
    ],
    listSelectedReposForOrgSecret: [
      "GET /orgs/{org}/actions/secrets/{secret_name}/repositories"
    ],
    listSelectedReposForOrgVariable: [
      "GET /orgs/{org}/actions/variables/{name}/repositories"
    ],
    listSelectedRepositoriesEnabledGithubActionsOrganization: [
      "GET /orgs/{org}/actions/permissions/repositories"
    ],
    listSelfHostedRunnersForOrg: ["GET /orgs/{org}/actions/runners"],
    listSelfHostedRunnersForRepo: ["GET /repos/{owner}/{repo}/actions/runners"],
    listWorkflowRunArtifacts: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts"
    ],
    listWorkflowRuns: [
      "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs"
    ],
    listWorkflowRunsForRepo: ["GET /repos/{owner}/{repo}/actions/runs"],
    reRunJobForWorkflowRun: [
      "POST /repos/{owner}/{repo}/actions/jobs/{job_id}/rerun"
    ],
    reRunWorkflow: ["POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun"],
    reRunWorkflowFailedJobs: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs"
    ],
    removeAllCustomLabelsFromSelfHostedRunnerForOrg: [
      "DELETE /orgs/{org}/actions/runners/{runner_id}/labels"
    ],
    removeAllCustomLabelsFromSelfHostedRunnerForRepo: [
      "DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}/labels"
    ],
    removeCustomLabelFromSelfHostedRunnerForOrg: [
      "DELETE /orgs/{org}/actions/runners/{runner_id}/labels/{name}"
    ],
    removeCustomLabelFromSelfHostedRunnerForRepo: [
      "DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}/labels/{name}"
    ],
    removeSelectedRepoFromOrgSecret: [
      "DELETE /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}"
    ],
    removeSelectedRepoFromOrgVariable: [
      "DELETE /orgs/{org}/actions/variables/{name}/repositories/{repository_id}"
    ],
    reviewCustomGatesForRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/deployment_protection_rule"
    ],
    reviewPendingDeploymentsForRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments"
    ],
    setAllowedActionsOrganization: [
      "PUT /orgs/{org}/actions/permissions/selected-actions"
    ],
    setAllowedActionsRepository: [
      "PUT /repos/{owner}/{repo}/actions/permissions/selected-actions"
    ],
    setCustomLabelsForSelfHostedRunnerForOrg: [
      "PUT /orgs/{org}/actions/runners/{runner_id}/labels"
    ],
    setCustomLabelsForSelfHostedRunnerForRepo: [
      "PUT /repos/{owner}/{repo}/actions/runners/{runner_id}/labels"
    ],
    setCustomOidcSubClaimForRepo: [
      "PUT /repos/{owner}/{repo}/actions/oidc/customization/sub"
    ],
    setGithubActionsDefaultWorkflowPermissionsOrganization: [
      "PUT /orgs/{org}/actions/permissions/workflow"
    ],
    setGithubActionsDefaultWorkflowPermissionsRepository: [
      "PUT /repos/{owner}/{repo}/actions/permissions/workflow"
    ],
    setGithubActionsPermissionsOrganization: [
      "PUT /orgs/{org}/actions/permissions"
    ],
    setGithubActionsPermissionsRepository: [
      "PUT /repos/{owner}/{repo}/actions/permissions"
    ],
    setSelectedReposForOrgSecret: [
      "PUT /orgs/{org}/actions/secrets/{secret_name}/repositories"
    ],
    setSelectedReposForOrgVariable: [
      "PUT /orgs/{org}/actions/variables/{name}/repositories"
    ],
    setSelectedRepositoriesEnabledGithubActionsOrganization: [
      "PUT /orgs/{org}/actions/permissions/repositories"
    ],
    setWorkflowAccessToRepository: [
      "PUT /repos/{owner}/{repo}/actions/permissions/access"
    ],
    updateEnvironmentVariable: [
      "PATCH /repositories/{repository_id}/environments/{environment_name}/variables/{name}"
    ],
    updateOrgVariable: ["PATCH /orgs/{org}/actions/variables/{name}"],
    updateRepoVariable: [
      "PATCH /repos/{owner}/{repo}/actions/variables/{name}"
    ]
  },
  activity: {
    checkRepoIsStarredByAuthenticatedUser: ["GET /user/starred/{owner}/{repo}"],
    deleteRepoSubscription: ["DELETE /repos/{owner}/{repo}/subscription"],
    deleteThreadSubscription: [
      "DELETE /notifications/threads/{thread_id}/subscription"
    ],
    getFeeds: ["GET /feeds"],
    getRepoSubscription: ["GET /repos/{owner}/{repo}/subscription"],
    getThread: ["GET /notifications/threads/{thread_id}"],
    getThreadSubscriptionForAuthenticatedUser: [
      "GET /notifications/threads/{thread_id}/subscription"
    ],
    listEventsForAuthenticatedUser: ["GET /users/{username}/events"],
    listNotificationsForAuthenticatedUser: ["GET /notifications"],
    listOrgEventsForAuthenticatedUser: [
      "GET /users/{username}/events/orgs/{org}"
    ],
    listPublicEvents: ["GET /events"],
    listPublicEventsForRepoNetwork: ["GET /networks/{owner}/{repo}/events"],
    listPublicEventsForUser: ["GET /users/{username}/events/public"],
    listPublicOrgEvents: ["GET /orgs/{org}/events"],
    listReceivedEventsForUser: ["GET /users/{username}/received_events"],
    listReceivedPublicEventsForUser: [
      "GET /users/{username}/received_events/public"
    ],
    listRepoEvents: ["GET /repos/{owner}/{repo}/events"],
    listRepoNotificationsForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/notifications"
    ],
    listReposStarredByAuthenticatedUser: ["GET /user/starred"],
    listReposStarredByUser: ["GET /users/{username}/starred"],
    listReposWatchedByUser: ["GET /users/{username}/subscriptions"],
    listStargazersForRepo: ["GET /repos/{owner}/{repo}/stargazers"],
    listWatchedReposForAuthenticatedUser: ["GET /user/subscriptions"],
    listWatchersForRepo: ["GET /repos/{owner}/{repo}/subscribers"],
    markNotificationsAsRead: ["PUT /notifications"],
    markRepoNotificationsAsRead: ["PUT /repos/{owner}/{repo}/notifications"],
    markThreadAsDone: ["DELETE /notifications/threads/{thread_id}"],
    markThreadAsRead: ["PATCH /notifications/threads/{thread_id}"],
    setRepoSubscription: ["PUT /repos/{owner}/{repo}/subscription"],
    setThreadSubscription: [
      "PUT /notifications/threads/{thread_id}/subscription"
    ],
    starRepoForAuthenticatedUser: ["PUT /user/starred/{owner}/{repo}"],
    unstarRepoForAuthenticatedUser: ["DELETE /user/starred/{owner}/{repo}"]
  },
  apps: {
    addRepoToInstallation: [
      "PUT /user/installations/{installation_id}/repositories/{repository_id}",
      {},
      { renamed: ["apps", "addRepoToInstallationForAuthenticatedUser"] }
    ],
    addRepoToInstallationForAuthenticatedUser: [
      "PUT /user/installations/{installation_id}/repositories/{repository_id}"
    ],
    checkToken: ["POST /applications/{client_id}/token"],
    createFromManifest: ["POST /app-manifests/{code}/conversions"],
    createInstallationAccessToken: [
      "POST /app/installations/{installation_id}/access_tokens"
    ],
    deleteAuthorization: ["DELETE /applications/{client_id}/grant"],
    deleteInstallation: ["DELETE /app/installations/{installation_id}"],
    deleteToken: ["DELETE /applications/{client_id}/token"],
    getAuthenticated: ["GET /app"],
    getBySlug: ["GET /apps/{app_slug}"],
    getInstallation: ["GET /app/installations/{installation_id}"],
    getOrgInstallation: ["GET /orgs/{org}/installation"],
    getRepoInstallation: ["GET /repos/{owner}/{repo}/installation"],
    getSubscriptionPlanForAccount: [
      "GET /marketplace_listing/accounts/{account_id}"
    ],
    getSubscriptionPlanForAccountStubbed: [
      "GET /marketplace_listing/stubbed/accounts/{account_id}"
    ],
    getUserInstallation: ["GET /users/{username}/installation"],
    getWebhookConfigForApp: ["GET /app/hook/config"],
    getWebhookDelivery: ["GET /app/hook/deliveries/{delivery_id}"],
    listAccountsForPlan: ["GET /marketplace_listing/plans/{plan_id}/accounts"],
    listAccountsForPlanStubbed: [
      "GET /marketplace_listing/stubbed/plans/{plan_id}/accounts"
    ],
    listInstallationReposForAuthenticatedUser: [
      "GET /user/installations/{installation_id}/repositories"
    ],
    listInstallationRequestsForAuthenticatedApp: [
      "GET /app/installation-requests"
    ],
    listInstallations: ["GET /app/installations"],
    listInstallationsForAuthenticatedUser: ["GET /user/installations"],
    listPlans: ["GET /marketplace_listing/plans"],
    listPlansStubbed: ["GET /marketplace_listing/stubbed/plans"],
    listReposAccessibleToInstallation: ["GET /installation/repositories"],
    listSubscriptionsForAuthenticatedUser: ["GET /user/marketplace_purchases"],
    listSubscriptionsForAuthenticatedUserStubbed: [
      "GET /user/marketplace_purchases/stubbed"
    ],
    listWebhookDeliveries: ["GET /app/hook/deliveries"],
    redeliverWebhookDelivery: [
      "POST /app/hook/deliveries/{delivery_id}/attempts"
    ],
    removeRepoFromInstallation: [
      "DELETE /user/installations/{installation_id}/repositories/{repository_id}",
      {},
      { renamed: ["apps", "removeRepoFromInstallationForAuthenticatedUser"] }
    ],
    removeRepoFromInstallationForAuthenticatedUser: [
      "DELETE /user/installations/{installation_id}/repositories/{repository_id}"
    ],
    resetToken: ["PATCH /applications/{client_id}/token"],
    revokeInstallationAccessToken: ["DELETE /installation/token"],
    scopeToken: ["POST /applications/{client_id}/token/scoped"],
    suspendInstallation: ["PUT /app/installations/{installation_id}/suspended"],
    unsuspendInstallation: [
      "DELETE /app/installations/{installation_id}/suspended"
    ],
    updateWebhookConfigForApp: ["PATCH /app/hook/config"]
  },
  billing: {
    getGithubActionsBillingOrg: ["GET /orgs/{org}/settings/billing/actions"],
    getGithubActionsBillingUser: [
      "GET /users/{username}/settings/billing/actions"
    ],
    getGithubPackagesBillingOrg: ["GET /orgs/{org}/settings/billing/packages"],
    getGithubPackagesBillingUser: [
      "GET /users/{username}/settings/billing/packages"
    ],
    getSharedStorageBillingOrg: [
      "GET /orgs/{org}/settings/billing/shared-storage"
    ],
    getSharedStorageBillingUser: [
      "GET /users/{username}/settings/billing/shared-storage"
    ]
  },
  checks: {
    create: ["POST /repos/{owner}/{repo}/check-runs"],
    createSuite: ["POST /repos/{owner}/{repo}/check-suites"],
    get: ["GET /repos/{owner}/{repo}/check-runs/{check_run_id}"],
    getSuite: ["GET /repos/{owner}/{repo}/check-suites/{check_suite_id}"],
    listAnnotations: [
      "GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations"
    ],
    listForRef: ["GET /repos/{owner}/{repo}/commits/{ref}/check-runs"],
    listForSuite: [
      "GET /repos/{owner}/{repo}/check-suites/{check_suite_id}/check-runs"
    ],
    listSuitesForRef: ["GET /repos/{owner}/{repo}/commits/{ref}/check-suites"],
    rerequestRun: [
      "POST /repos/{owner}/{repo}/check-runs/{check_run_id}/rerequest"
    ],
    rerequestSuite: [
      "POST /repos/{owner}/{repo}/check-suites/{check_suite_id}/rerequest"
    ],
    setSuitesPreferences: [
      "PATCH /repos/{owner}/{repo}/check-suites/preferences"
    ],
    update: ["PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}"]
  },
  codeScanning: {
    deleteAnalysis: [
      "DELETE /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}{?confirm_delete}"
    ],
    getAlert: [
      "GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}",
      {},
      { renamedParameters: { alert_id: "alert_number" } }
    ],
    getAnalysis: [
      "GET /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}"
    ],
    getCodeqlDatabase: [
      "GET /repos/{owner}/{repo}/code-scanning/codeql/databases/{language}"
    ],
    getDefaultSetup: ["GET /repos/{owner}/{repo}/code-scanning/default-setup"],
    getSarif: ["GET /repos/{owner}/{repo}/code-scanning/sarifs/{sarif_id}"],
    listAlertInstances: [
      "GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/instances"
    ],
    listAlertsForOrg: ["GET /orgs/{org}/code-scanning/alerts"],
    listAlertsForRepo: ["GET /repos/{owner}/{repo}/code-scanning/alerts"],
    listAlertsInstances: [
      "GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/instances",
      {},
      { renamed: ["codeScanning", "listAlertInstances"] }
    ],
    listCodeqlDatabases: [
      "GET /repos/{owner}/{repo}/code-scanning/codeql/databases"
    ],
    listRecentAnalyses: ["GET /repos/{owner}/{repo}/code-scanning/analyses"],
    updateAlert: [
      "PATCH /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}"
    ],
    updateDefaultSetup: [
      "PATCH /repos/{owner}/{repo}/code-scanning/default-setup"
    ],
    uploadSarif: ["POST /repos/{owner}/{repo}/code-scanning/sarifs"]
  },
  codesOfConduct: {
    getAllCodesOfConduct: ["GET /codes_of_conduct"],
    getConductCode: ["GET /codes_of_conduct/{key}"]
  },
  codespaces: {
    addRepositoryForSecretForAuthenticatedUser: [
      "PUT /user/codespaces/secrets/{secret_name}/repositories/{repository_id}"
    ],
    addSelectedRepoToOrgSecret: [
      "PUT /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}"
    ],
    checkPermissionsForDevcontainer: [
      "GET /repos/{owner}/{repo}/codespaces/permissions_check"
    ],
    codespaceMachinesForAuthenticatedUser: [
      "GET /user/codespaces/{codespace_name}/machines"
    ],
    createForAuthenticatedUser: ["POST /user/codespaces"],
    createOrUpdateOrgSecret: [
      "PUT /orgs/{org}/codespaces/secrets/{secret_name}"
    ],
    createOrUpdateRepoSecret: [
      "PUT /repos/{owner}/{repo}/codespaces/secrets/{secret_name}"
    ],
    createOrUpdateSecretForAuthenticatedUser: [
      "PUT /user/codespaces/secrets/{secret_name}"
    ],
    createWithPrForAuthenticatedUser: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/codespaces"
    ],
    createWithRepoForAuthenticatedUser: [
      "POST /repos/{owner}/{repo}/codespaces"
    ],
    deleteForAuthenticatedUser: ["DELETE /user/codespaces/{codespace_name}"],
    deleteFromOrganization: [
      "DELETE /orgs/{org}/members/{username}/codespaces/{codespace_name}"
    ],
    deleteOrgSecret: ["DELETE /orgs/{org}/codespaces/secrets/{secret_name}"],
    deleteRepoSecret: [
      "DELETE /repos/{owner}/{repo}/codespaces/secrets/{secret_name}"
    ],
    deleteSecretForAuthenticatedUser: [
      "DELETE /user/codespaces/secrets/{secret_name}"
    ],
    exportForAuthenticatedUser: [
      "POST /user/codespaces/{codespace_name}/exports"
    ],
    getCodespacesForUserInOrg: [
      "GET /orgs/{org}/members/{username}/codespaces"
    ],
    getExportDetailsForAuthenticatedUser: [
      "GET /user/codespaces/{codespace_name}/exports/{export_id}"
    ],
    getForAuthenticatedUser: ["GET /user/codespaces/{codespace_name}"],
    getOrgPublicKey: ["GET /orgs/{org}/codespaces/secrets/public-key"],
    getOrgSecret: ["GET /orgs/{org}/codespaces/secrets/{secret_name}"],
    getPublicKeyForAuthenticatedUser: [
      "GET /user/codespaces/secrets/public-key"
    ],
    getRepoPublicKey: [
      "GET /repos/{owner}/{repo}/codespaces/secrets/public-key"
    ],
    getRepoSecret: [
      "GET /repos/{owner}/{repo}/codespaces/secrets/{secret_name}"
    ],
    getSecretForAuthenticatedUser: [
      "GET /user/codespaces/secrets/{secret_name}"
    ],
    listDevcontainersInRepositoryForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/codespaces/devcontainers"
    ],
    listForAuthenticatedUser: ["GET /user/codespaces"],
    listInOrganization: [
      "GET /orgs/{org}/codespaces",
      {},
      { renamedParameters: { org_id: "org" } }
    ],
    listInRepositoryForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/codespaces"
    ],
    listOrgSecrets: ["GET /orgs/{org}/codespaces/secrets"],
    listRepoSecrets: ["GET /repos/{owner}/{repo}/codespaces/secrets"],
    listRepositoriesForSecretForAuthenticatedUser: [
      "GET /user/codespaces/secrets/{secret_name}/repositories"
    ],
    listSecretsForAuthenticatedUser: ["GET /user/codespaces/secrets"],
    listSelectedReposForOrgSecret: [
      "GET /orgs/{org}/codespaces/secrets/{secret_name}/repositories"
    ],
    preFlightWithRepoForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/codespaces/new"
    ],
    publishForAuthenticatedUser: [
      "POST /user/codespaces/{codespace_name}/publish"
    ],
    removeRepositoryForSecretForAuthenticatedUser: [
      "DELETE /user/codespaces/secrets/{secret_name}/repositories/{repository_id}"
    ],
    removeSelectedRepoFromOrgSecret: [
      "DELETE /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}"
    ],
    repoMachinesForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/codespaces/machines"
    ],
    setRepositoriesForSecretForAuthenticatedUser: [
      "PUT /user/codespaces/secrets/{secret_name}/repositories"
    ],
    setSelectedReposForOrgSecret: [
      "PUT /orgs/{org}/codespaces/secrets/{secret_name}/repositories"
    ],
    startForAuthenticatedUser: ["POST /user/codespaces/{codespace_name}/start"],
    stopForAuthenticatedUser: ["POST /user/codespaces/{codespace_name}/stop"],
    stopInOrganization: [
      "POST /orgs/{org}/members/{username}/codespaces/{codespace_name}/stop"
    ],
    updateForAuthenticatedUser: ["PATCH /user/codespaces/{codespace_name}"]
  },
  copilot: {
    addCopilotSeatsForTeams: [
      "POST /orgs/{org}/copilot/billing/selected_teams"
    ],
    addCopilotSeatsForUsers: [
      "POST /orgs/{org}/copilot/billing/selected_users"
    ],
    cancelCopilotSeatAssignmentForTeams: [
      "DELETE /orgs/{org}/copilot/billing/selected_teams"
    ],
    cancelCopilotSeatAssignmentForUsers: [
      "DELETE /orgs/{org}/copilot/billing/selected_users"
    ],
    getCopilotOrganizationDetails: ["GET /orgs/{org}/copilot/billing"],
    getCopilotSeatDetailsForUser: [
      "GET /orgs/{org}/members/{username}/copilot"
    ],
    listCopilotSeats: ["GET /orgs/{org}/copilot/billing/seats"]
  },
  dependabot: {
    addSelectedRepoToOrgSecret: [
      "PUT /orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}"
    ],
    createOrUpdateOrgSecret: [
      "PUT /orgs/{org}/dependabot/secrets/{secret_name}"
    ],
    createOrUpdateRepoSecret: [
      "PUT /repos/{owner}/{repo}/dependabot/secrets/{secret_name}"
    ],
    deleteOrgSecret: ["DELETE /orgs/{org}/dependabot/secrets/{secret_name}"],
    deleteRepoSecret: [
      "DELETE /repos/{owner}/{repo}/dependabot/secrets/{secret_name}"
    ],
    getAlert: ["GET /repos/{owner}/{repo}/dependabot/alerts/{alert_number}"],
    getOrgPublicKey: ["GET /orgs/{org}/dependabot/secrets/public-key"],
    getOrgSecret: ["GET /orgs/{org}/dependabot/secrets/{secret_name}"],
    getRepoPublicKey: [
      "GET /repos/{owner}/{repo}/dependabot/secrets/public-key"
    ],
    getRepoSecret: [
      "GET /repos/{owner}/{repo}/dependabot/secrets/{secret_name}"
    ],
    listAlertsForEnterprise: [
      "GET /enterprises/{enterprise}/dependabot/alerts"
    ],
    listAlertsForOrg: ["GET /orgs/{org}/dependabot/alerts"],
    listAlertsForRepo: ["GET /repos/{owner}/{repo}/dependabot/alerts"],
    listOrgSecrets: ["GET /orgs/{org}/dependabot/secrets"],
    listRepoSecrets: ["GET /repos/{owner}/{repo}/dependabot/secrets"],
    listSelectedReposForOrgSecret: [
      "GET /orgs/{org}/dependabot/secrets/{secret_name}/repositories"
    ],
    removeSelectedRepoFromOrgSecret: [
      "DELETE /orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}"
    ],
    setSelectedReposForOrgSecret: [
      "PUT /orgs/{org}/dependabot/secrets/{secret_name}/repositories"
    ],
    updateAlert: [
      "PATCH /repos/{owner}/{repo}/dependabot/alerts/{alert_number}"
    ]
  },
  dependencyGraph: {
    createRepositorySnapshot: [
      "POST /repos/{owner}/{repo}/dependency-graph/snapshots"
    ],
    diffRange: [
      "GET /repos/{owner}/{repo}/dependency-graph/compare/{basehead}"
    ],
    exportSbom: ["GET /repos/{owner}/{repo}/dependency-graph/sbom"]
  },
  emojis: { get: ["GET /emojis"] },
  gists: {
    checkIsStarred: ["GET /gists/{gist_id}/star"],
    create: ["POST /gists"],
    createComment: ["POST /gists/{gist_id}/comments"],
    delete: ["DELETE /gists/{gist_id}"],
    deleteComment: ["DELETE /gists/{gist_id}/comments/{comment_id}"],
    fork: ["POST /gists/{gist_id}/forks"],
    get: ["GET /gists/{gist_id}"],
    getComment: ["GET /gists/{gist_id}/comments/{comment_id}"],
    getRevision: ["GET /gists/{gist_id}/{sha}"],
    list: ["GET /gists"],
    listComments: ["GET /gists/{gist_id}/comments"],
    listCommits: ["GET /gists/{gist_id}/commits"],
    listForUser: ["GET /users/{username}/gists"],
    listForks: ["GET /gists/{gist_id}/forks"],
    listPublic: ["GET /gists/public"],
    listStarred: ["GET /gists/starred"],
    star: ["PUT /gists/{gist_id}/star"],
    unstar: ["DELETE /gists/{gist_id}/star"],
    update: ["PATCH /gists/{gist_id}"],
    updateComment: ["PATCH /gists/{gist_id}/comments/{comment_id}"]
  },
  git: {
    createBlob: ["POST /repos/{owner}/{repo}/git/blobs"],
    createCommit: ["POST /repos/{owner}/{repo}/git/commits"],
    createRef: ["POST /repos/{owner}/{repo}/git/refs"],
    createTag: ["POST /repos/{owner}/{repo}/git/tags"],
    createTree: ["POST /repos/{owner}/{repo}/git/trees"],
    deleteRef: ["DELETE /repos/{owner}/{repo}/git/refs/{ref}"],
    getBlob: ["GET /repos/{owner}/{repo}/git/blobs/{file_sha}"],
    getCommit: ["GET /repos/{owner}/{repo}/git/commits/{commit_sha}"],
    getRef: ["GET /repos/{owner}/{repo}/git/ref/{ref}"],
    getTag: ["GET /repos/{owner}/{repo}/git/tags/{tag_sha}"],
    getTree: ["GET /repos/{owner}/{repo}/git/trees/{tree_sha}"],
    listMatchingRefs: ["GET /repos/{owner}/{repo}/git/matching-refs/{ref}"],
    updateRef: ["PATCH /repos/{owner}/{repo}/git/refs/{ref}"]
  },
  gitignore: {
    getAllTemplates: ["GET /gitignore/templates"],
    getTemplate: ["GET /gitignore/templates/{name}"]
  },
  interactions: {
    getRestrictionsForAuthenticatedUser: ["GET /user/interaction-limits"],
    getRestrictionsForOrg: ["GET /orgs/{org}/interaction-limits"],
    getRestrictionsForRepo: ["GET /repos/{owner}/{repo}/interaction-limits"],
    getRestrictionsForYourPublicRepos: [
      "GET /user/interaction-limits",
      {},
      { renamed: ["interactions", "getRestrictionsForAuthenticatedUser"] }
    ],
    removeRestrictionsForAuthenticatedUser: ["DELETE /user/interaction-limits"],
    removeRestrictionsForOrg: ["DELETE /orgs/{org}/interaction-limits"],
    removeRestrictionsForRepo: [
      "DELETE /repos/{owner}/{repo}/interaction-limits"
    ],
    removeRestrictionsForYourPublicRepos: [
      "DELETE /user/interaction-limits",
      {},
      { renamed: ["interactions", "removeRestrictionsForAuthenticatedUser"] }
    ],
    setRestrictionsForAuthenticatedUser: ["PUT /user/interaction-limits"],
    setRestrictionsForOrg: ["PUT /orgs/{org}/interaction-limits"],
    setRestrictionsForRepo: ["PUT /repos/{owner}/{repo}/interaction-limits"],
    setRestrictionsForYourPublicRepos: [
      "PUT /user/interaction-limits",
      {},
      { renamed: ["interactions", "setRestrictionsForAuthenticatedUser"] }
    ]
  },
  issues: {
    addAssignees: [
      "POST /repos/{owner}/{repo}/issues/{issue_number}/assignees"
    ],
    addLabels: ["POST /repos/{owner}/{repo}/issues/{issue_number}/labels"],
    checkUserCanBeAssigned: ["GET /repos/{owner}/{repo}/assignees/{assignee}"],
    checkUserCanBeAssignedToIssue: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/assignees/{assignee}"
    ],
    create: ["POST /repos/{owner}/{repo}/issues"],
    createComment: [
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments"
    ],
    createLabel: ["POST /repos/{owner}/{repo}/labels"],
    createMilestone: ["POST /repos/{owner}/{repo}/milestones"],
    deleteComment: [
      "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}"
    ],
    deleteLabel: ["DELETE /repos/{owner}/{repo}/labels/{name}"],
    deleteMilestone: [
      "DELETE /repos/{owner}/{repo}/milestones/{milestone_number}"
    ],
    get: ["GET /repos/{owner}/{repo}/issues/{issue_number}"],
    getComment: ["GET /repos/{owner}/{repo}/issues/comments/{comment_id}"],
    getEvent: ["GET /repos/{owner}/{repo}/issues/events/{event_id}"],
    getLabel: ["GET /repos/{owner}/{repo}/labels/{name}"],
    getMilestone: ["GET /repos/{owner}/{repo}/milestones/{milestone_number}"],
    list: ["GET /issues"],
    listAssignees: ["GET /repos/{owner}/{repo}/assignees"],
    listComments: ["GET /repos/{owner}/{repo}/issues/{issue_number}/comments"],
    listCommentsForRepo: ["GET /repos/{owner}/{repo}/issues/comments"],
    listEvents: ["GET /repos/{owner}/{repo}/issues/{issue_number}/events"],
    listEventsForRepo: ["GET /repos/{owner}/{repo}/issues/events"],
    listEventsForTimeline: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline"
    ],
    listForAuthenticatedUser: ["GET /user/issues"],
    listForOrg: ["GET /orgs/{org}/issues"],
    listForRepo: ["GET /repos/{owner}/{repo}/issues"],
    listLabelsForMilestone: [
      "GET /repos/{owner}/{repo}/milestones/{milestone_number}/labels"
    ],
    listLabelsForRepo: ["GET /repos/{owner}/{repo}/labels"],
    listLabelsOnIssue: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/labels"
    ],
    listMilestones: ["GET /repos/{owner}/{repo}/milestones"],
    lock: ["PUT /repos/{owner}/{repo}/issues/{issue_number}/lock"],
    removeAllLabels: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels"
    ],
    removeAssignees: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees"
    ],
    removeLabel: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}"
    ],
    setLabels: ["PUT /repos/{owner}/{repo}/issues/{issue_number}/labels"],
    unlock: ["DELETE /repos/{owner}/{repo}/issues/{issue_number}/lock"],
    update: ["PATCH /repos/{owner}/{repo}/issues/{issue_number}"],
    updateComment: ["PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}"],
    updateLabel: ["PATCH /repos/{owner}/{repo}/labels/{name}"],
    updateMilestone: [
      "PATCH /repos/{owner}/{repo}/milestones/{milestone_number}"
    ]
  },
  licenses: {
    get: ["GET /licenses/{license}"],
    getAllCommonlyUsed: ["GET /licenses"],
    getForRepo: ["GET /repos/{owner}/{repo}/license"]
  },
  markdown: {
    render: ["POST /markdown"],
    renderRaw: [
      "POST /markdown/raw",
      { headers: { "content-type": "text/plain; charset=utf-8" } }
    ]
  },
  meta: {
    get: ["GET /meta"],
    getAllVersions: ["GET /versions"],
    getOctocat: ["GET /octocat"],
    getZen: ["GET /zen"],
    root: ["GET /"]
  },
  migrations: {
    cancelImport: [
      "DELETE /repos/{owner}/{repo}/import",
      {},
      {
        deprecated: "octokit.rest.migrations.cancelImport() is deprecated, see https://docs.github.com/rest/migrations/source-imports#cancel-an-import"
      }
    ],
    deleteArchiveForAuthenticatedUser: [
      "DELETE /user/migrations/{migration_id}/archive"
    ],
    deleteArchiveForOrg: [
      "DELETE /orgs/{org}/migrations/{migration_id}/archive"
    ],
    downloadArchiveForOrg: [
      "GET /orgs/{org}/migrations/{migration_id}/archive"
    ],
    getArchiveForAuthenticatedUser: [
      "GET /user/migrations/{migration_id}/archive"
    ],
    getCommitAuthors: [
      "GET /repos/{owner}/{repo}/import/authors",
      {},
      {
        deprecated: "octokit.rest.migrations.getCommitAuthors() is deprecated, see https://docs.github.com/rest/migrations/source-imports#get-commit-authors"
      }
    ],
    getImportStatus: [
      "GET /repos/{owner}/{repo}/import",
      {},
      {
        deprecated: "octokit.rest.migrations.getImportStatus() is deprecated, see https://docs.github.com/rest/migrations/source-imports#get-an-import-status"
      }
    ],
    getLargeFiles: [
      "GET /repos/{owner}/{repo}/import/large_files",
      {},
      {
        deprecated: "octokit.rest.migrations.getLargeFiles() is deprecated, see https://docs.github.com/rest/migrations/source-imports#get-large-files"
      }
    ],
    getStatusForAuthenticatedUser: ["GET /user/migrations/{migration_id}"],
    getStatusForOrg: ["GET /orgs/{org}/migrations/{migration_id}"],
    listForAuthenticatedUser: ["GET /user/migrations"],
    listForOrg: ["GET /orgs/{org}/migrations"],
    listReposForAuthenticatedUser: [
      "GET /user/migrations/{migration_id}/repositories"
    ],
    listReposForOrg: ["GET /orgs/{org}/migrations/{migration_id}/repositories"],
    listReposForUser: [
      "GET /user/migrations/{migration_id}/repositories",
      {},
      { renamed: ["migrations", "listReposForAuthenticatedUser"] }
    ],
    mapCommitAuthor: [
      "PATCH /repos/{owner}/{repo}/import/authors/{author_id}",
      {},
      {
        deprecated: "octokit.rest.migrations.mapCommitAuthor() is deprecated, see https://docs.github.com/rest/migrations/source-imports#map-a-commit-author"
      }
    ],
    setLfsPreference: [
      "PATCH /repos/{owner}/{repo}/import/lfs",
      {},
      {
        deprecated: "octokit.rest.migrations.setLfsPreference() is deprecated, see https://docs.github.com/rest/migrations/source-imports#update-git-lfs-preference"
      }
    ],
    startForAuthenticatedUser: ["POST /user/migrations"],
    startForOrg: ["POST /orgs/{org}/migrations"],
    startImport: [
      "PUT /repos/{owner}/{repo}/import",
      {},
      {
        deprecated: "octokit.rest.migrations.startImport() is deprecated, see https://docs.github.com/rest/migrations/source-imports#start-an-import"
      }
    ],
    unlockRepoForAuthenticatedUser: [
      "DELETE /user/migrations/{migration_id}/repos/{repo_name}/lock"
    ],
    unlockRepoForOrg: [
      "DELETE /orgs/{org}/migrations/{migration_id}/repos/{repo_name}/lock"
    ],
    updateImport: [
      "PATCH /repos/{owner}/{repo}/import",
      {},
      {
        deprecated: "octokit.rest.migrations.updateImport() is deprecated, see https://docs.github.com/rest/migrations/source-imports#update-an-import"
      }
    ]
  },
  oidc: {
    getOidcCustomSubTemplateForOrg: [
      "GET /orgs/{org}/actions/oidc/customization/sub"
    ],
    updateOidcCustomSubTemplateForOrg: [
      "PUT /orgs/{org}/actions/oidc/customization/sub"
    ]
  },
  orgs: {
    addSecurityManagerTeam: [
      "PUT /orgs/{org}/security-managers/teams/{team_slug}"
    ],
    assignTeamToOrgRole: [
      "PUT /orgs/{org}/organization-roles/teams/{team_slug}/{role_id}"
    ],
    assignUserToOrgRole: [
      "PUT /orgs/{org}/organization-roles/users/{username}/{role_id}"
    ],
    blockUser: ["PUT /orgs/{org}/blocks/{username}"],
    cancelInvitation: ["DELETE /orgs/{org}/invitations/{invitation_id}"],
    checkBlockedUser: ["GET /orgs/{org}/blocks/{username}"],
    checkMembershipForUser: ["GET /orgs/{org}/members/{username}"],
    checkPublicMembershipForUser: ["GET /orgs/{org}/public_members/{username}"],
    convertMemberToOutsideCollaborator: [
      "PUT /orgs/{org}/outside_collaborators/{username}"
    ],
    createCustomOrganizationRole: ["POST /orgs/{org}/organization-roles"],
    createInvitation: ["POST /orgs/{org}/invitations"],
    createOrUpdateCustomProperties: ["PATCH /orgs/{org}/properties/schema"],
    createOrUpdateCustomPropertiesValuesForRepos: [
      "PATCH /orgs/{org}/properties/values"
    ],
    createOrUpdateCustomProperty: [
      "PUT /orgs/{org}/properties/schema/{custom_property_name}"
    ],
    createWebhook: ["POST /orgs/{org}/hooks"],
    delete: ["DELETE /orgs/{org}"],
    deleteCustomOrganizationRole: [
      "DELETE /orgs/{org}/organization-roles/{role_id}"
    ],
    deleteWebhook: ["DELETE /orgs/{org}/hooks/{hook_id}"],
    enableOrDisableSecurityProductOnAllOrgRepos: [
      "POST /orgs/{org}/{security_product}/{enablement}"
    ],
    get: ["GET /orgs/{org}"],
    getAllCustomProperties: ["GET /orgs/{org}/properties/schema"],
    getCustomProperty: [
      "GET /orgs/{org}/properties/schema/{custom_property_name}"
    ],
    getMembershipForAuthenticatedUser: ["GET /user/memberships/orgs/{org}"],
    getMembershipForUser: ["GET /orgs/{org}/memberships/{username}"],
    getOrgRole: ["GET /orgs/{org}/organization-roles/{role_id}"],
    getWebhook: ["GET /orgs/{org}/hooks/{hook_id}"],
    getWebhookConfigForOrg: ["GET /orgs/{org}/hooks/{hook_id}/config"],
    getWebhookDelivery: [
      "GET /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}"
    ],
    list: ["GET /organizations"],
    listAppInstallations: ["GET /orgs/{org}/installations"],
    listBlockedUsers: ["GET /orgs/{org}/blocks"],
    listCustomPropertiesValuesForRepos: ["GET /orgs/{org}/properties/values"],
    listFailedInvitations: ["GET /orgs/{org}/failed_invitations"],
    listForAuthenticatedUser: ["GET /user/orgs"],
    listForUser: ["GET /users/{username}/orgs"],
    listInvitationTeams: ["GET /orgs/{org}/invitations/{invitation_id}/teams"],
    listMembers: ["GET /orgs/{org}/members"],
    listMembershipsForAuthenticatedUser: ["GET /user/memberships/orgs"],
    listOrgRoleTeams: ["GET /orgs/{org}/organization-roles/{role_id}/teams"],
    listOrgRoleUsers: ["GET /orgs/{org}/organization-roles/{role_id}/users"],
    listOrgRoles: ["GET /orgs/{org}/organization-roles"],
    listOrganizationFineGrainedPermissions: [
      "GET /orgs/{org}/organization-fine-grained-permissions"
    ],
    listOutsideCollaborators: ["GET /orgs/{org}/outside_collaborators"],
    listPatGrantRepositories: [
      "GET /orgs/{org}/personal-access-tokens/{pat_id}/repositories"
    ],
    listPatGrantRequestRepositories: [
      "GET /orgs/{org}/personal-access-token-requests/{pat_request_id}/repositories"
    ],
    listPatGrantRequests: ["GET /orgs/{org}/personal-access-token-requests"],
    listPatGrants: ["GET /orgs/{org}/personal-access-tokens"],
    listPendingInvitations: ["GET /orgs/{org}/invitations"],
    listPublicMembers: ["GET /orgs/{org}/public_members"],
    listSecurityManagerTeams: ["GET /orgs/{org}/security-managers"],
    listWebhookDeliveries: ["GET /orgs/{org}/hooks/{hook_id}/deliveries"],
    listWebhooks: ["GET /orgs/{org}/hooks"],
    patchCustomOrganizationRole: [
      "PATCH /orgs/{org}/organization-roles/{role_id}"
    ],
    pingWebhook: ["POST /orgs/{org}/hooks/{hook_id}/pings"],
    redeliverWebhookDelivery: [
      "POST /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}/attempts"
    ],
    removeCustomProperty: [
      "DELETE /orgs/{org}/properties/schema/{custom_property_name}"
    ],
    removeMember: ["DELETE /orgs/{org}/members/{username}"],
    removeMembershipForUser: ["DELETE /orgs/{org}/memberships/{username}"],
    removeOutsideCollaborator: [
      "DELETE /orgs/{org}/outside_collaborators/{username}"
    ],
    removePublicMembershipForAuthenticatedUser: [
      "DELETE /orgs/{org}/public_members/{username}"
    ],
    removeSecurityManagerTeam: [
      "DELETE /orgs/{org}/security-managers/teams/{team_slug}"
    ],
    reviewPatGrantRequest: [
      "POST /orgs/{org}/personal-access-token-requests/{pat_request_id}"
    ],
    reviewPatGrantRequestsInBulk: [
      "POST /orgs/{org}/personal-access-token-requests"
    ],
    revokeAllOrgRolesTeam: [
      "DELETE /orgs/{org}/organization-roles/teams/{team_slug}"
    ],
    revokeAllOrgRolesUser: [
      "DELETE /orgs/{org}/organization-roles/users/{username}"
    ],
    revokeOrgRoleTeam: [
      "DELETE /orgs/{org}/organization-roles/teams/{team_slug}/{role_id}"
    ],
    revokeOrgRoleUser: [
      "DELETE /orgs/{org}/organization-roles/users/{username}/{role_id}"
    ],
    setMembershipForUser: ["PUT /orgs/{org}/memberships/{username}"],
    setPublicMembershipForAuthenticatedUser: [
      "PUT /orgs/{org}/public_members/{username}"
    ],
    unblockUser: ["DELETE /orgs/{org}/blocks/{username}"],
    update: ["PATCH /orgs/{org}"],
    updateMembershipForAuthenticatedUser: [
      "PATCH /user/memberships/orgs/{org}"
    ],
    updatePatAccess: ["POST /orgs/{org}/personal-access-tokens/{pat_id}"],
    updatePatAccesses: ["POST /orgs/{org}/personal-access-tokens"],
    updateWebhook: ["PATCH /orgs/{org}/hooks/{hook_id}"],
    updateWebhookConfigForOrg: ["PATCH /orgs/{org}/hooks/{hook_id}/config"]
  },
  packages: {
    deletePackageForAuthenticatedUser: [
      "DELETE /user/packages/{package_type}/{package_name}"
    ],
    deletePackageForOrg: [
      "DELETE /orgs/{org}/packages/{package_type}/{package_name}"
    ],
    deletePackageForUser: [
      "DELETE /users/{username}/packages/{package_type}/{package_name}"
    ],
    deletePackageVersionForAuthenticatedUser: [
      "DELETE /user/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    deletePackageVersionForOrg: [
      "DELETE /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    deletePackageVersionForUser: [
      "DELETE /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    getAllPackageVersionsForAPackageOwnedByAnOrg: [
      "GET /orgs/{org}/packages/{package_type}/{package_name}/versions",
      {},
      { renamed: ["packages", "getAllPackageVersionsForPackageOwnedByOrg"] }
    ],
    getAllPackageVersionsForAPackageOwnedByTheAuthenticatedUser: [
      "GET /user/packages/{package_type}/{package_name}/versions",
      {},
      {
        renamed: [
          "packages",
          "getAllPackageVersionsForPackageOwnedByAuthenticatedUser"
        ]
      }
    ],
    getAllPackageVersionsForPackageOwnedByAuthenticatedUser: [
      "GET /user/packages/{package_type}/{package_name}/versions"
    ],
    getAllPackageVersionsForPackageOwnedByOrg: [
      "GET /orgs/{org}/packages/{package_type}/{package_name}/versions"
    ],
    getAllPackageVersionsForPackageOwnedByUser: [
      "GET /users/{username}/packages/{package_type}/{package_name}/versions"
    ],
    getPackageForAuthenticatedUser: [
      "GET /user/packages/{package_type}/{package_name}"
    ],
    getPackageForOrganization: [
      "GET /orgs/{org}/packages/{package_type}/{package_name}"
    ],
    getPackageForUser: [
      "GET /users/{username}/packages/{package_type}/{package_name}"
    ],
    getPackageVersionForAuthenticatedUser: [
      "GET /user/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    getPackageVersionForOrganization: [
      "GET /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    getPackageVersionForUser: [
      "GET /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    listDockerMigrationConflictingPackagesForAuthenticatedUser: [
      "GET /user/docker/conflicts"
    ],
    listDockerMigrationConflictingPackagesForOrganization: [
      "GET /orgs/{org}/docker/conflicts"
    ],
    listDockerMigrationConflictingPackagesForUser: [
      "GET /users/{username}/docker/conflicts"
    ],
    listPackagesForAuthenticatedUser: ["GET /user/packages"],
    listPackagesForOrganization: ["GET /orgs/{org}/packages"],
    listPackagesForUser: ["GET /users/{username}/packages"],
    restorePackageForAuthenticatedUser: [
      "POST /user/packages/{package_type}/{package_name}/restore{?token}"
    ],
    restorePackageForOrg: [
      "POST /orgs/{org}/packages/{package_type}/{package_name}/restore{?token}"
    ],
    restorePackageForUser: [
      "POST /users/{username}/packages/{package_type}/{package_name}/restore{?token}"
    ],
    restorePackageVersionForAuthenticatedUser: [
      "POST /user/packages/{package_type}/{package_name}/versions/{package_version_id}/restore"
    ],
    restorePackageVersionForOrg: [
      "POST /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore"
    ],
    restorePackageVersionForUser: [
      "POST /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore"
    ]
  },
  projects: {
    addCollaborator: ["PUT /projects/{project_id}/collaborators/{username}"],
    createCard: ["POST /projects/columns/{column_id}/cards"],
    createColumn: ["POST /projects/{project_id}/columns"],
    createForAuthenticatedUser: ["POST /user/projects"],
    createForOrg: ["POST /orgs/{org}/projects"],
    createForRepo: ["POST /repos/{owner}/{repo}/projects"],
    delete: ["DELETE /projects/{project_id}"],
    deleteCard: ["DELETE /projects/columns/cards/{card_id}"],
    deleteColumn: ["DELETE /projects/columns/{column_id}"],
    get: ["GET /projects/{project_id}"],
    getCard: ["GET /projects/columns/cards/{card_id}"],
    getColumn: ["GET /projects/columns/{column_id}"],
    getPermissionForUser: [
      "GET /projects/{project_id}/collaborators/{username}/permission"
    ],
    listCards: ["GET /projects/columns/{column_id}/cards"],
    listCollaborators: ["GET /projects/{project_id}/collaborators"],
    listColumns: ["GET /projects/{project_id}/columns"],
    listForOrg: ["GET /orgs/{org}/projects"],
    listForRepo: ["GET /repos/{owner}/{repo}/projects"],
    listForUser: ["GET /users/{username}/projects"],
    moveCard: ["POST /projects/columns/cards/{card_id}/moves"],
    moveColumn: ["POST /projects/columns/{column_id}/moves"],
    removeCollaborator: [
      "DELETE /projects/{project_id}/collaborators/{username}"
    ],
    update: ["PATCH /projects/{project_id}"],
    updateCard: ["PATCH /projects/columns/cards/{card_id}"],
    updateColumn: ["PATCH /projects/columns/{column_id}"]
  },
  pulls: {
    checkIfMerged: ["GET /repos/{owner}/{repo}/pulls/{pull_number}/merge"],
    create: ["POST /repos/{owner}/{repo}/pulls"],
    createReplyForReviewComment: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies"
    ],
    createReview: ["POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews"],
    createReviewComment: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments"
    ],
    deletePendingReview: [
      "DELETE /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}"
    ],
    deleteReviewComment: [
      "DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}"
    ],
    dismissReview: [
      "PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals"
    ],
    get: ["GET /repos/{owner}/{repo}/pulls/{pull_number}"],
    getReview: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}"
    ],
    getReviewComment: ["GET /repos/{owner}/{repo}/pulls/comments/{comment_id}"],
    list: ["GET /repos/{owner}/{repo}/pulls"],
    listCommentsForReview: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments"
    ],
    listCommits: ["GET /repos/{owner}/{repo}/pulls/{pull_number}/commits"],
    listFiles: ["GET /repos/{owner}/{repo}/pulls/{pull_number}/files"],
    listRequestedReviewers: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers"
    ],
    listReviewComments: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments"
    ],
    listReviewCommentsForRepo: ["GET /repos/{owner}/{repo}/pulls/comments"],
    listReviews: ["GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews"],
    merge: ["PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge"],
    removeRequestedReviewers: [
      "DELETE /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers"
    ],
    requestReviewers: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers"
    ],
    submitReview: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/events"
    ],
    update: ["PATCH /repos/{owner}/{repo}/pulls/{pull_number}"],
    updateBranch: [
      "PUT /repos/{owner}/{repo}/pulls/{pull_number}/update-branch"
    ],
    updateReview: [
      "PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}"
    ],
    updateReviewComment: [
      "PATCH /repos/{owner}/{repo}/pulls/comments/{comment_id}"
    ]
  },
  rateLimit: { get: ["GET /rate_limit"] },
  reactions: {
    createForCommitComment: [
      "POST /repos/{owner}/{repo}/comments/{comment_id}/reactions"
    ],
    createForIssue: [
      "POST /repos/{owner}/{repo}/issues/{issue_number}/reactions"
    ],
    createForIssueComment: [
      "POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions"
    ],
    createForPullRequestReviewComment: [
      "POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions"
    ],
    createForRelease: [
      "POST /repos/{owner}/{repo}/releases/{release_id}/reactions"
    ],
    createForTeamDiscussionCommentInOrg: [
      "POST /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions"
    ],
    createForTeamDiscussionInOrg: [
      "POST /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions"
    ],
    deleteForCommitComment: [
      "DELETE /repos/{owner}/{repo}/comments/{comment_id}/reactions/{reaction_id}"
    ],
    deleteForIssue: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}"
    ],
    deleteForIssueComment: [
      "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions/{reaction_id}"
    ],
    deleteForPullRequestComment: [
      "DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions/{reaction_id}"
    ],
    deleteForRelease: [
      "DELETE /repos/{owner}/{repo}/releases/{release_id}/reactions/{reaction_id}"
    ],
    deleteForTeamDiscussion: [
      "DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions/{reaction_id}"
    ],
    deleteForTeamDiscussionComment: [
      "DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions/{reaction_id}"
    ],
    listForCommitComment: [
      "GET /repos/{owner}/{repo}/comments/{comment_id}/reactions"
    ],
    listForIssue: ["GET /repos/{owner}/{repo}/issues/{issue_number}/reactions"],
    listForIssueComment: [
      "GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions"
    ],
    listForPullRequestReviewComment: [
      "GET /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions"
    ],
    listForRelease: [
      "GET /repos/{owner}/{repo}/releases/{release_id}/reactions"
    ],
    listForTeamDiscussionCommentInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions"
    ],
    listForTeamDiscussionInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions"
    ]
  },
  repos: {
    acceptInvitation: [
      "PATCH /user/repository_invitations/{invitation_id}",
      {},
      { renamed: ["repos", "acceptInvitationForAuthenticatedUser"] }
    ],
    acceptInvitationForAuthenticatedUser: [
      "PATCH /user/repository_invitations/{invitation_id}"
    ],
    addAppAccessRestrictions: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps",
      {},
      { mapToData: "apps" }
    ],
    addCollaborator: ["PUT /repos/{owner}/{repo}/collaborators/{username}"],
    addStatusCheckContexts: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts",
      {},
      { mapToData: "contexts" }
    ],
    addTeamAccessRestrictions: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams",
      {},
      { mapToData: "teams" }
    ],
    addUserAccessRestrictions: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users",
      {},
      { mapToData: "users" }
    ],
    cancelPagesDeployment: [
      "POST /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}/cancel"
    ],
    checkAutomatedSecurityFixes: [
      "GET /repos/{owner}/{repo}/automated-security-fixes"
    ],
    checkCollaborator: ["GET /repos/{owner}/{repo}/collaborators/{username}"],
    checkVulnerabilityAlerts: [
      "GET /repos/{owner}/{repo}/vulnerability-alerts"
    ],
    codeownersErrors: ["GET /repos/{owner}/{repo}/codeowners/errors"],
    compareCommits: ["GET /repos/{owner}/{repo}/compare/{base}...{head}"],
    compareCommitsWithBasehead: [
      "GET /repos/{owner}/{repo}/compare/{basehead}"
    ],
    createAutolink: ["POST /repos/{owner}/{repo}/autolinks"],
    createCommitComment: [
      "POST /repos/{owner}/{repo}/commits/{commit_sha}/comments"
    ],
    createCommitSignatureProtection: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures"
    ],
    createCommitStatus: ["POST /repos/{owner}/{repo}/statuses/{sha}"],
    createDeployKey: ["POST /repos/{owner}/{repo}/keys"],
    createDeployment: ["POST /repos/{owner}/{repo}/deployments"],
    createDeploymentBranchPolicy: [
      "POST /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies"
    ],
    createDeploymentProtectionRule: [
      "POST /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules"
    ],
    createDeploymentStatus: [
      "POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses"
    ],
    createDispatchEvent: ["POST /repos/{owner}/{repo}/dispatches"],
    createForAuthenticatedUser: ["POST /user/repos"],
    createFork: ["POST /repos/{owner}/{repo}/forks"],
    createInOrg: ["POST /orgs/{org}/repos"],
    createOrUpdateCustomPropertiesValues: [
      "PATCH /repos/{owner}/{repo}/properties/values"
    ],
    createOrUpdateEnvironment: [
      "PUT /repos/{owner}/{repo}/environments/{environment_name}"
    ],
    createOrUpdateFileContents: ["PUT /repos/{owner}/{repo}/contents/{path}"],
    createOrgRuleset: ["POST /orgs/{org}/rulesets"],
    createPagesDeployment: ["POST /repos/{owner}/{repo}/pages/deployments"],
    createPagesSite: ["POST /repos/{owner}/{repo}/pages"],
    createRelease: ["POST /repos/{owner}/{repo}/releases"],
    createRepoRuleset: ["POST /repos/{owner}/{repo}/rulesets"],
    createTagProtection: ["POST /repos/{owner}/{repo}/tags/protection"],
    createUsingTemplate: [
      "POST /repos/{template_owner}/{template_repo}/generate"
    ],
    createWebhook: ["POST /repos/{owner}/{repo}/hooks"],
    declineInvitation: [
      "DELETE /user/repository_invitations/{invitation_id}",
      {},
      { renamed: ["repos", "declineInvitationForAuthenticatedUser"] }
    ],
    declineInvitationForAuthenticatedUser: [
      "DELETE /user/repository_invitations/{invitation_id}"
    ],
    delete: ["DELETE /repos/{owner}/{repo}"],
    deleteAccessRestrictions: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions"
    ],
    deleteAdminBranchProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins"
    ],
    deleteAnEnvironment: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}"
    ],
    deleteAutolink: ["DELETE /repos/{owner}/{repo}/autolinks/{autolink_id}"],
    deleteBranchProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection"
    ],
    deleteCommitComment: ["DELETE /repos/{owner}/{repo}/comments/{comment_id}"],
    deleteCommitSignatureProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures"
    ],
    deleteDeployKey: ["DELETE /repos/{owner}/{repo}/keys/{key_id}"],
    deleteDeployment: [
      "DELETE /repos/{owner}/{repo}/deployments/{deployment_id}"
    ],
    deleteDeploymentBranchPolicy: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}"
    ],
    deleteFile: ["DELETE /repos/{owner}/{repo}/contents/{path}"],
    deleteInvitation: [
      "DELETE /repos/{owner}/{repo}/invitations/{invitation_id}"
    ],
    deleteOrgRuleset: ["DELETE /orgs/{org}/rulesets/{ruleset_id}"],
    deletePagesSite: ["DELETE /repos/{owner}/{repo}/pages"],
    deletePullRequestReviewProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews"
    ],
    deleteRelease: ["DELETE /repos/{owner}/{repo}/releases/{release_id}"],
    deleteReleaseAsset: [
      "DELETE /repos/{owner}/{repo}/releases/assets/{asset_id}"
    ],
    deleteRepoRuleset: ["DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}"],
    deleteTagProtection: [
      "DELETE /repos/{owner}/{repo}/tags/protection/{tag_protection_id}"
    ],
    deleteWebhook: ["DELETE /repos/{owner}/{repo}/hooks/{hook_id}"],
    disableAutomatedSecurityFixes: [
      "DELETE /repos/{owner}/{repo}/automated-security-fixes"
    ],
    disableDeploymentProtectionRule: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/{protection_rule_id}"
    ],
    disablePrivateVulnerabilityReporting: [
      "DELETE /repos/{owner}/{repo}/private-vulnerability-reporting"
    ],
    disableVulnerabilityAlerts: [
      "DELETE /repos/{owner}/{repo}/vulnerability-alerts"
    ],
    downloadArchive: [
      "GET /repos/{owner}/{repo}/zipball/{ref}",
      {},
      { renamed: ["repos", "downloadZipballArchive"] }
    ],
    downloadTarballArchive: ["GET /repos/{owner}/{repo}/tarball/{ref}"],
    downloadZipballArchive: ["GET /repos/{owner}/{repo}/zipball/{ref}"],
    enableAutomatedSecurityFixes: [
      "PUT /repos/{owner}/{repo}/automated-security-fixes"
    ],
    enablePrivateVulnerabilityReporting: [
      "PUT /repos/{owner}/{repo}/private-vulnerability-reporting"
    ],
    enableVulnerabilityAlerts: [
      "PUT /repos/{owner}/{repo}/vulnerability-alerts"
    ],
    generateReleaseNotes: [
      "POST /repos/{owner}/{repo}/releases/generate-notes"
    ],
    get: ["GET /repos/{owner}/{repo}"],
    getAccessRestrictions: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions"
    ],
    getAdminBranchProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins"
    ],
    getAllDeploymentProtectionRules: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules"
    ],
    getAllEnvironments: ["GET /repos/{owner}/{repo}/environments"],
    getAllStatusCheckContexts: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts"
    ],
    getAllTopics: ["GET /repos/{owner}/{repo}/topics"],
    getAppsWithAccessToProtectedBranch: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps"
    ],
    getAutolink: ["GET /repos/{owner}/{repo}/autolinks/{autolink_id}"],
    getBranch: ["GET /repos/{owner}/{repo}/branches/{branch}"],
    getBranchProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection"
    ],
    getBranchRules: ["GET /repos/{owner}/{repo}/rules/branches/{branch}"],
    getClones: ["GET /repos/{owner}/{repo}/traffic/clones"],
    getCodeFrequencyStats: ["GET /repos/{owner}/{repo}/stats/code_frequency"],
    getCollaboratorPermissionLevel: [
      "GET /repos/{owner}/{repo}/collaborators/{username}/permission"
    ],
    getCombinedStatusForRef: ["GET /repos/{owner}/{repo}/commits/{ref}/status"],
    getCommit: ["GET /repos/{owner}/{repo}/commits/{ref}"],
    getCommitActivityStats: ["GET /repos/{owner}/{repo}/stats/commit_activity"],
    getCommitComment: ["GET /repos/{owner}/{repo}/comments/{comment_id}"],
    getCommitSignatureProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures"
    ],
    getCommunityProfileMetrics: ["GET /repos/{owner}/{repo}/community/profile"],
    getContent: ["GET /repos/{owner}/{repo}/contents/{path}"],
    getContributorsStats: ["GET /repos/{owner}/{repo}/stats/contributors"],
    getCustomDeploymentProtectionRule: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/{protection_rule_id}"
    ],
    getCustomPropertiesValues: ["GET /repos/{owner}/{repo}/properties/values"],
    getDeployKey: ["GET /repos/{owner}/{repo}/keys/{key_id}"],
    getDeployment: ["GET /repos/{owner}/{repo}/deployments/{deployment_id}"],
    getDeploymentBranchPolicy: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}"
    ],
    getDeploymentStatus: [
      "GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses/{status_id}"
    ],
    getEnvironment: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}"
    ],
    getLatestPagesBuild: ["GET /repos/{owner}/{repo}/pages/builds/latest"],
    getLatestRelease: ["GET /repos/{owner}/{repo}/releases/latest"],
    getOrgRuleSuite: ["GET /orgs/{org}/rulesets/rule-suites/{rule_suite_id}"],
    getOrgRuleSuites: ["GET /orgs/{org}/rulesets/rule-suites"],
    getOrgRuleset: ["GET /orgs/{org}/rulesets/{ruleset_id}"],
    getOrgRulesets: ["GET /orgs/{org}/rulesets"],
    getPages: ["GET /repos/{owner}/{repo}/pages"],
    getPagesBuild: ["GET /repos/{owner}/{repo}/pages/builds/{build_id}"],
    getPagesDeployment: [
      "GET /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}"
    ],
    getPagesHealthCheck: ["GET /repos/{owner}/{repo}/pages/health"],
    getParticipationStats: ["GET /repos/{owner}/{repo}/stats/participation"],
    getPullRequestReviewProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews"
    ],
    getPunchCardStats: ["GET /repos/{owner}/{repo}/stats/punch_card"],
    getReadme: ["GET /repos/{owner}/{repo}/readme"],
    getReadmeInDirectory: ["GET /repos/{owner}/{repo}/readme/{dir}"],
    getRelease: ["GET /repos/{owner}/{repo}/releases/{release_id}"],
    getReleaseAsset: ["GET /repos/{owner}/{repo}/releases/assets/{asset_id}"],
    getReleaseByTag: ["GET /repos/{owner}/{repo}/releases/tags/{tag}"],
    getRepoRuleSuite: [
      "GET /repos/{owner}/{repo}/rulesets/rule-suites/{rule_suite_id}"
    ],
    getRepoRuleSuites: ["GET /repos/{owner}/{repo}/rulesets/rule-suites"],
    getRepoRuleset: ["GET /repos/{owner}/{repo}/rulesets/{ruleset_id}"],
    getRepoRulesets: ["GET /repos/{owner}/{repo}/rulesets"],
    getStatusChecksProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks"
    ],
    getTeamsWithAccessToProtectedBranch: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams"
    ],
    getTopPaths: ["GET /repos/{owner}/{repo}/traffic/popular/paths"],
    getTopReferrers: ["GET /repos/{owner}/{repo}/traffic/popular/referrers"],
    getUsersWithAccessToProtectedBranch: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users"
    ],
    getViews: ["GET /repos/{owner}/{repo}/traffic/views"],
    getWebhook: ["GET /repos/{owner}/{repo}/hooks/{hook_id}"],
    getWebhookConfigForRepo: [
      "GET /repos/{owner}/{repo}/hooks/{hook_id}/config"
    ],
    getWebhookDelivery: [
      "GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}"
    ],
    listActivities: ["GET /repos/{owner}/{repo}/activity"],
    listAutolinks: ["GET /repos/{owner}/{repo}/autolinks"],
    listBranches: ["GET /repos/{owner}/{repo}/branches"],
    listBranchesForHeadCommit: [
      "GET /repos/{owner}/{repo}/commits/{commit_sha}/branches-where-head"
    ],
    listCollaborators: ["GET /repos/{owner}/{repo}/collaborators"],
    listCommentsForCommit: [
      "GET /repos/{owner}/{repo}/commits/{commit_sha}/comments"
    ],
    listCommitCommentsForRepo: ["GET /repos/{owner}/{repo}/comments"],
    listCommitStatusesForRef: [
      "GET /repos/{owner}/{repo}/commits/{ref}/statuses"
    ],
    listCommits: ["GET /repos/{owner}/{repo}/commits"],
    listContributors: ["GET /repos/{owner}/{repo}/contributors"],
    listCustomDeploymentRuleIntegrations: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/apps"
    ],
    listDeployKeys: ["GET /repos/{owner}/{repo}/keys"],
    listDeploymentBranchPolicies: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies"
    ],
    listDeploymentStatuses: [
      "GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses"
    ],
    listDeployments: ["GET /repos/{owner}/{repo}/deployments"],
    listForAuthenticatedUser: ["GET /user/repos"],
    listForOrg: ["GET /orgs/{org}/repos"],
    listForUser: ["GET /users/{username}/repos"],
    listForks: ["GET /repos/{owner}/{repo}/forks"],
    listInvitations: ["GET /repos/{owner}/{repo}/invitations"],
    listInvitationsForAuthenticatedUser: ["GET /user/repository_invitations"],
    listLanguages: ["GET /repos/{owner}/{repo}/languages"],
    listPagesBuilds: ["GET /repos/{owner}/{repo}/pages/builds"],
    listPublic: ["GET /repositories"],
    listPullRequestsAssociatedWithCommit: [
      "GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls"
    ],
    listReleaseAssets: [
      "GET /repos/{owner}/{repo}/releases/{release_id}/assets"
    ],
    listReleases: ["GET /repos/{owner}/{repo}/releases"],
    listTagProtection: ["GET /repos/{owner}/{repo}/tags/protection"],
    listTags: ["GET /repos/{owner}/{repo}/tags"],
    listTeams: ["GET /repos/{owner}/{repo}/teams"],
    listWebhookDeliveries: [
      "GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries"
    ],
    listWebhooks: ["GET /repos/{owner}/{repo}/hooks"],
    merge: ["POST /repos/{owner}/{repo}/merges"],
    mergeUpstream: ["POST /repos/{owner}/{repo}/merge-upstream"],
    pingWebhook: ["POST /repos/{owner}/{repo}/hooks/{hook_id}/pings"],
    redeliverWebhookDelivery: [
      "POST /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}/attempts"
    ],
    removeAppAccessRestrictions: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps",
      {},
      { mapToData: "apps" }
    ],
    removeCollaborator: [
      "DELETE /repos/{owner}/{repo}/collaborators/{username}"
    ],
    removeStatusCheckContexts: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts",
      {},
      { mapToData: "contexts" }
    ],
    removeStatusCheckProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks"
    ],
    removeTeamAccessRestrictions: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams",
      {},
      { mapToData: "teams" }
    ],
    removeUserAccessRestrictions: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users",
      {},
      { mapToData: "users" }
    ],
    renameBranch: ["POST /repos/{owner}/{repo}/branches/{branch}/rename"],
    replaceAllTopics: ["PUT /repos/{owner}/{repo}/topics"],
    requestPagesBuild: ["POST /repos/{owner}/{repo}/pages/builds"],
    setAdminBranchProtection: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins"
    ],
    setAppAccessRestrictions: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps",
      {},
      { mapToData: "apps" }
    ],
    setStatusCheckContexts: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts",
      {},
      { mapToData: "contexts" }
    ],
    setTeamAccessRestrictions: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams",
      {},
      { mapToData: "teams" }
    ],
    setUserAccessRestrictions: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users",
      {},
      { mapToData: "users" }
    ],
    testPushWebhook: ["POST /repos/{owner}/{repo}/hooks/{hook_id}/tests"],
    transfer: ["POST /repos/{owner}/{repo}/transfer"],
    update: ["PATCH /repos/{owner}/{repo}"],
    updateBranchProtection: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection"
    ],
    updateCommitComment: ["PATCH /repos/{owner}/{repo}/comments/{comment_id}"],
    updateDeploymentBranchPolicy: [
      "PUT /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}"
    ],
    updateInformationAboutPagesSite: ["PUT /repos/{owner}/{repo}/pages"],
    updateInvitation: [
      "PATCH /repos/{owner}/{repo}/invitations/{invitation_id}"
    ],
    updateOrgRuleset: ["PUT /orgs/{org}/rulesets/{ruleset_id}"],
    updatePullRequestReviewProtection: [
      "PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews"
    ],
    updateRelease: ["PATCH /repos/{owner}/{repo}/releases/{release_id}"],
    updateReleaseAsset: [
      "PATCH /repos/{owner}/{repo}/releases/assets/{asset_id}"
    ],
    updateRepoRuleset: ["PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}"],
    updateStatusCheckPotection: [
      "PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks",
      {},
      { renamed: ["repos", "updateStatusCheckProtection"] }
    ],
    updateStatusCheckProtection: [
      "PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks"
    ],
    updateWebhook: ["PATCH /repos/{owner}/{repo}/hooks/{hook_id}"],
    updateWebhookConfigForRepo: [
      "PATCH /repos/{owner}/{repo}/hooks/{hook_id}/config"
    ],
    uploadReleaseAsset: [
      "POST /repos/{owner}/{repo}/releases/{release_id}/assets{?name,label}",
      { baseUrl: "https://uploads.github.com" }
    ]
  },
  search: {
    code: ["GET /search/code"],
    commits: ["GET /search/commits"],
    issuesAndPullRequests: ["GET /search/issues"],
    labels: ["GET /search/labels"],
    repos: ["GET /search/repositories"],
    topics: ["GET /search/topics"],
    users: ["GET /search/users"]
  },
  secretScanning: {
    getAlert: [
      "GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}"
    ],
    listAlertsForEnterprise: [
      "GET /enterprises/{enterprise}/secret-scanning/alerts"
    ],
    listAlertsForOrg: ["GET /orgs/{org}/secret-scanning/alerts"],
    listAlertsForRepo: ["GET /repos/{owner}/{repo}/secret-scanning/alerts"],
    listLocationsForAlert: [
      "GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}/locations"
    ],
    updateAlert: [
      "PATCH /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}"
    ]
  },
  securityAdvisories: {
    createFork: [
      "POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/forks"
    ],
    createPrivateVulnerabilityReport: [
      "POST /repos/{owner}/{repo}/security-advisories/reports"
    ],
    createRepositoryAdvisory: [
      "POST /repos/{owner}/{repo}/security-advisories"
    ],
    createRepositoryAdvisoryCveRequest: [
      "POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/cve"
    ],
    getGlobalAdvisory: ["GET /advisories/{ghsa_id}"],
    getRepositoryAdvisory: [
      "GET /repos/{owner}/{repo}/security-advisories/{ghsa_id}"
    ],
    listGlobalAdvisories: ["GET /advisories"],
    listOrgRepositoryAdvisories: ["GET /orgs/{org}/security-advisories"],
    listRepositoryAdvisories: ["GET /repos/{owner}/{repo}/security-advisories"],
    updateRepositoryAdvisory: [
      "PATCH /repos/{owner}/{repo}/security-advisories/{ghsa_id}"
    ]
  },
  teams: {
    addOrUpdateMembershipForUserInOrg: [
      "PUT /orgs/{org}/teams/{team_slug}/memberships/{username}"
    ],
    addOrUpdateProjectPermissionsInOrg: [
      "PUT /orgs/{org}/teams/{team_slug}/projects/{project_id}"
    ],
    addOrUpdateRepoPermissionsInOrg: [
      "PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}"
    ],
    checkPermissionsForProjectInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/projects/{project_id}"
    ],
    checkPermissionsForRepoInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}"
    ],
    create: ["POST /orgs/{org}/teams"],
    createDiscussionCommentInOrg: [
      "POST /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments"
    ],
    createDiscussionInOrg: ["POST /orgs/{org}/teams/{team_slug}/discussions"],
    deleteDiscussionCommentInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}"
    ],
    deleteDiscussionInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}"
    ],
    deleteInOrg: ["DELETE /orgs/{org}/teams/{team_slug}"],
    getByName: ["GET /orgs/{org}/teams/{team_slug}"],
    getDiscussionCommentInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}"
    ],
    getDiscussionInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}"
    ],
    getMembershipForUserInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/memberships/{username}"
    ],
    list: ["GET /orgs/{org}/teams"],
    listChildInOrg: ["GET /orgs/{org}/teams/{team_slug}/teams"],
    listDiscussionCommentsInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments"
    ],
    listDiscussionsInOrg: ["GET /orgs/{org}/teams/{team_slug}/discussions"],
    listForAuthenticatedUser: ["GET /user/teams"],
    listMembersInOrg: ["GET /orgs/{org}/teams/{team_slug}/members"],
    listPendingInvitationsInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/invitations"
    ],
    listProjectsInOrg: ["GET /orgs/{org}/teams/{team_slug}/projects"],
    listReposInOrg: ["GET /orgs/{org}/teams/{team_slug}/repos"],
    removeMembershipForUserInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/memberships/{username}"
    ],
    removeProjectInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/projects/{project_id}"
    ],
    removeRepoInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}"
    ],
    updateDiscussionCommentInOrg: [
      "PATCH /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}"
    ],
    updateDiscussionInOrg: [
      "PATCH /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}"
    ],
    updateInOrg: ["PATCH /orgs/{org}/teams/{team_slug}"]
  },
  users: {
    addEmailForAuthenticated: [
      "POST /user/emails",
      {},
      { renamed: ["users", "addEmailForAuthenticatedUser"] }
    ],
    addEmailForAuthenticatedUser: ["POST /user/emails"],
    addSocialAccountForAuthenticatedUser: ["POST /user/social_accounts"],
    block: ["PUT /user/blocks/{username}"],
    checkBlocked: ["GET /user/blocks/{username}"],
    checkFollowingForUser: ["GET /users/{username}/following/{target_user}"],
    checkPersonIsFollowedByAuthenticated: ["GET /user/following/{username}"],
    createGpgKeyForAuthenticated: [
      "POST /user/gpg_keys",
      {},
      { renamed: ["users", "createGpgKeyForAuthenticatedUser"] }
    ],
    createGpgKeyForAuthenticatedUser: ["POST /user/gpg_keys"],
    createPublicSshKeyForAuthenticated: [
      "POST /user/keys",
      {},
      { renamed: ["users", "createPublicSshKeyForAuthenticatedUser"] }
    ],
    createPublicSshKeyForAuthenticatedUser: ["POST /user/keys"],
    createSshSigningKeyForAuthenticatedUser: ["POST /user/ssh_signing_keys"],
    deleteEmailForAuthenticated: [
      "DELETE /user/emails",
      {},
      { renamed: ["users", "deleteEmailForAuthenticatedUser"] }
    ],
    deleteEmailForAuthenticatedUser: ["DELETE /user/emails"],
    deleteGpgKeyForAuthenticated: [
      "DELETE /user/gpg_keys/{gpg_key_id}",
      {},
      { renamed: ["users", "deleteGpgKeyForAuthenticatedUser"] }
    ],
    deleteGpgKeyForAuthenticatedUser: ["DELETE /user/gpg_keys/{gpg_key_id}"],
    deletePublicSshKeyForAuthenticated: [
      "DELETE /user/keys/{key_id}",
      {},
      { renamed: ["users", "deletePublicSshKeyForAuthenticatedUser"] }
    ],
    deletePublicSshKeyForAuthenticatedUser: ["DELETE /user/keys/{key_id}"],
    deleteSocialAccountForAuthenticatedUser: ["DELETE /user/social_accounts"],
    deleteSshSigningKeyForAuthenticatedUser: [
      "DELETE /user/ssh_signing_keys/{ssh_signing_key_id}"
    ],
    follow: ["PUT /user/following/{username}"],
    getAuthenticated: ["GET /user"],
    getByUsername: ["GET /users/{username}"],
    getContextForUser: ["GET /users/{username}/hovercard"],
    getGpgKeyForAuthenticated: [
      "GET /user/gpg_keys/{gpg_key_id}",
      {},
      { renamed: ["users", "getGpgKeyForAuthenticatedUser"] }
    ],
    getGpgKeyForAuthenticatedUser: ["GET /user/gpg_keys/{gpg_key_id}"],
    getPublicSshKeyForAuthenticated: [
      "GET /user/keys/{key_id}",
      {},
      { renamed: ["users", "getPublicSshKeyForAuthenticatedUser"] }
    ],
    getPublicSshKeyForAuthenticatedUser: ["GET /user/keys/{key_id}"],
    getSshSigningKeyForAuthenticatedUser: [
      "GET /user/ssh_signing_keys/{ssh_signing_key_id}"
    ],
    list: ["GET /users"],
    listBlockedByAuthenticated: [
      "GET /user/blocks",
      {},
      { renamed: ["users", "listBlockedByAuthenticatedUser"] }
    ],
    listBlockedByAuthenticatedUser: ["GET /user/blocks"],
    listEmailsForAuthenticated: [
      "GET /user/emails",
      {},
      { renamed: ["users", "listEmailsForAuthenticatedUser"] }
    ],
    listEmailsForAuthenticatedUser: ["GET /user/emails"],
    listFollowedByAuthenticated: [
      "GET /user/following",
      {},
      { renamed: ["users", "listFollowedByAuthenticatedUser"] }
    ],
    listFollowedByAuthenticatedUser: ["GET /user/following"],
    listFollowersForAuthenticatedUser: ["GET /user/followers"],
    listFollowersForUser: ["GET /users/{username}/followers"],
    listFollowingForUser: ["GET /users/{username}/following"],
    listGpgKeysForAuthenticated: [
      "GET /user/gpg_keys",
      {},
      { renamed: ["users", "listGpgKeysForAuthenticatedUser"] }
    ],
    listGpgKeysForAuthenticatedUser: ["GET /user/gpg_keys"],
    listGpgKeysForUser: ["GET /users/{username}/gpg_keys"],
    listPublicEmailsForAuthenticated: [
      "GET /user/public_emails",
      {},
      { renamed: ["users", "listPublicEmailsForAuthenticatedUser"] }
    ],
    listPublicEmailsForAuthenticatedUser: ["GET /user/public_emails"],
    listPublicKeysForUser: ["GET /users/{username}/keys"],
    listPublicSshKeysForAuthenticated: [
      "GET /user/keys",
      {},
      { renamed: ["users", "listPublicSshKeysForAuthenticatedUser"] }
    ],
    listPublicSshKeysForAuthenticatedUser: ["GET /user/keys"],
    listSocialAccountsForAuthenticatedUser: ["GET /user/social_accounts"],
    listSocialAccountsForUser: ["GET /users/{username}/social_accounts"],
    listSshSigningKeysForAuthenticatedUser: ["GET /user/ssh_signing_keys"],
    listSshSigningKeysForUser: ["GET /users/{username}/ssh_signing_keys"],
    setPrimaryEmailVisibilityForAuthenticated: [
      "PATCH /user/email/visibility",
      {},
      { renamed: ["users", "setPrimaryEmailVisibilityForAuthenticatedUser"] }
    ],
    setPrimaryEmailVisibilityForAuthenticatedUser: [
      "PATCH /user/email/visibility"
    ],
    unblock: ["DELETE /user/blocks/{username}"],
    unfollow: ["DELETE /user/following/{username}"],
    updateAuthenticated: ["PATCH /user"]
  }
};
var endpoints_default = Endpoints;

// pkg/dist-src/endpoints-to-methods.js
var endpointMethodsMap = /* @__PURE__ */ new Map();
for (const [scope, endpoints] of Object.entries(endpoints_default)) {
  for (const [methodName, endpoint] of Object.entries(endpoints)) {
    const [route, defaults, decorations] = endpoint;
    const [method, url] = route.split(/ /);
    const endpointDefaults = Object.assign(
      {
        method,
        url
      },
      defaults
    );
    if (!endpointMethodsMap.has(scope)) {
      endpointMethodsMap.set(scope, /* @__PURE__ */ new Map());
    }
    endpointMethodsMap.get(scope).set(methodName, {
      scope,
      methodName,
      endpointDefaults,
      decorations
    });
  }
}
var handler = {
  has({ scope }, methodName) {
    return endpointMethodsMap.get(scope).has(methodName);
  },
  getOwnPropertyDescriptor(target, methodName) {
    return {
      value: this.get(target, methodName),
      // ensures method is in the cache
      configurable: true,
      writable: true,
      enumerable: true
    };
  },
  defineProperty(target, methodName, descriptor) {
    Object.defineProperty(target.cache, methodName, descriptor);
    return true;
  },
  deleteProperty(target, methodName) {
    delete target.cache[methodName];
    return true;
  },
  ownKeys({ scope }) {
    return [...endpointMethodsMap.get(scope).keys()];
  },
  set(target, methodName, value) {
    return target.cache[methodName] = value;
  },
  get({ octokit, scope, cache }, methodName) {
    if (cache[methodName]) {
      return cache[methodName];
    }
    const method = endpointMethodsMap.get(scope).get(methodName);
    if (!method) {
      return void 0;
    }
    const { endpointDefaults, decorations } = method;
    if (decorations) {
      cache[methodName] = decorate(
        octokit,
        scope,
        methodName,
        endpointDefaults,
        decorations
      );
    } else {
      cache[methodName] = octokit.request.defaults(endpointDefaults);
    }
    return cache[methodName];
  }
};
function endpointsToMethods(octokit) {
  const newMethods = {};
  for (const scope of endpointMethodsMap.keys()) {
    newMethods[scope] = new Proxy({ octokit, scope, cache: {} }, handler);
  }
  return newMethods;
}
function decorate(octokit, scope, methodName, defaults, decorations) {
  const requestWithDefaults = octokit.request.defaults(defaults);
  function withDecorations(...args) {
    let options = requestWithDefaults.endpoint.merge(...args);
    if (decorations.mapToData) {
      options = Object.assign({}, options, {
        data: options[decorations.mapToData],
        [decorations.mapToData]: void 0
      });
      return requestWithDefaults(options);
    }
    if (decorations.renamed) {
      const [newScope, newMethodName] = decorations.renamed;
      octokit.log.warn(
        `octokit.${scope}.${methodName}() has been renamed to octokit.${newScope}.${newMethodName}()`
      );
    }
    if (decorations.deprecated) {
      octokit.log.warn(decorations.deprecated);
    }
    if (decorations.renamedParameters) {
      const options2 = requestWithDefaults.endpoint.merge(...args);
      for (const [name, alias] of Object.entries(
        decorations.renamedParameters
      )) {
        if (name in options2) {
          octokit.log.warn(
            `"${name}" parameter is deprecated for "octokit.${scope}.${methodName}()". Use "${alias}" instead`
          );
          if (!(alias in options2)) {
            options2[alias] = options2[name];
          }
          delete options2[name];
        }
      }
      return requestWithDefaults(options2);
    }
    return requestWithDefaults(...args);
  }
  return Object.assign(withDecorations, requestWithDefaults);
}

// pkg/dist-src/index.js
function restEndpointMethods(octokit) {
  const api = endpointsToMethods(octokit);
  return {
    rest: api
  };
}
restEndpointMethods.VERSION = VERSION;
function legacyRestEndpointMethods(octokit) {
  const api = endpointsToMethods(octokit);
  return {
    ...api,
    rest: api
  };
}
legacyRestEndpointMethods.VERSION = VERSION;
// Annotate the CommonJS export names for ESM import in node:
0 && (0);


/***/ }),

/***/ 33450:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// pkg/dist-src/index.js
var dist_src_exports = {};
__export(dist_src_exports, {
  VERSION: () => VERSION,
  retry: () => retry
});
module.exports = __toCommonJS(dist_src_exports);
var import_core = __nccwpck_require__(61897);

// pkg/dist-src/error-request.js
async function errorRequest(state, octokit, error, options) {
  if (!error.request || !error.request.request) {
    throw error;
  }
  if (error.status >= 400 && !state.doNotRetry.includes(error.status)) {
    const retries = options.request.retries != null ? options.request.retries : state.retries;
    const retryAfter = Math.pow((options.request.retryCount || 0) + 1, 2);
    throw octokit.retry.retryRequest(error, retries, retryAfter);
  }
  throw error;
}

// pkg/dist-src/wrap-request.js
var import_light = __toESM(__nccwpck_require__(63251));
var import_request_error = __nccwpck_require__(93708);
async function wrapRequest(state, octokit, request, options) {
  const limiter = new import_light.default();
  limiter.on("failed", function(error, info) {
    const maxRetries = ~~error.request.request.retries;
    const after = ~~error.request.request.retryAfter;
    options.request.retryCount = info.retryCount + 1;
    if (maxRetries > info.retryCount) {
      return after * state.retryAfterBaseValue;
    }
  });
  return limiter.schedule(
    requestWithGraphqlErrorHandling.bind(null, state, octokit, request),
    options
  );
}
async function requestWithGraphqlErrorHandling(state, octokit, request, options) {
  const response = await request(request, options);
  if (response.data && response.data.errors && /Something went wrong while executing your query/.test(
    response.data.errors[0].message
  )) {
    const error = new import_request_error.RequestError(response.data.errors[0].message, 500, {
      request: options,
      response
    });
    return errorRequest(state, octokit, error, options);
  }
  return response;
}

// pkg/dist-src/index.js
var VERSION = "6.0.1";
function retry(octokit, octokitOptions) {
  const state = Object.assign(
    {
      enabled: true,
      retryAfterBaseValue: 1e3,
      doNotRetry: [400, 401, 403, 404, 422, 451],
      retries: 3
    },
    octokitOptions.retry
  );
  if (state.enabled) {
    octokit.hook.error("request", errorRequest.bind(null, state, octokit));
    octokit.hook.wrap("request", wrapRequest.bind(null, state, octokit));
  }
  return {
    retry: {
      retryRequest: (error, retries, retryAfter) => {
        error.request.request = Object.assign({}, error.request.request, {
          retries,
          retryAfter
        });
        return error;
      }
    }
  };
}
retry.VERSION = VERSION;
// Annotate the CommonJS export names for ESM import in node:
0 && (0);


/***/ }),

/***/ 93708:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// pkg/dist-src/index.js
var dist_src_exports = {};
__export(dist_src_exports, {
  RequestError: () => RequestError
});
module.exports = __toCommonJS(dist_src_exports);
var import_deprecation = __nccwpck_require__(14150);
var import_once = __toESM(__nccwpck_require__(55560));
var logOnceCode = (0, import_once.default)((deprecation) => console.warn(deprecation));
var logOnceHeaders = (0, import_once.default)((deprecation) => console.warn(deprecation));
var RequestError = class extends Error {
  constructor(message, statusCode, options) {
    super(message);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    this.name = "HttpError";
    this.status = statusCode;
    let headers;
    if ("headers" in options && typeof options.headers !== "undefined") {
      headers = options.headers;
    }
    if ("response" in options) {
      this.response = options.response;
      headers = options.response.headers;
    }
    const requestCopy = Object.assign({}, options.request);
    if (options.request.headers.authorization) {
      requestCopy.headers = Object.assign({}, options.request.headers, {
        authorization: options.request.headers.authorization.replace(
          /(?<! ) .*$/,
          " [REDACTED]"
        )
      });
    }
    requestCopy.url = requestCopy.url.replace(/\bclient_secret=\w+/g, "client_secret=[REDACTED]").replace(/\baccess_token=\w+/g, "access_token=[REDACTED]");
    this.request = requestCopy;
    Object.defineProperty(this, "code", {
      get() {
        logOnceCode(
          new import_deprecation.Deprecation(
            "[@octokit/request-error] `error.code` is deprecated, use `error.status`."
          )
        );
        return statusCode;
      }
    });
    Object.defineProperty(this, "headers", {
      get() {
        logOnceHeaders(
          new import_deprecation.Deprecation(
            "[@octokit/request-error] `error.headers` is deprecated, use `error.response.headers`."
          )
        );
        return headers || {};
      }
    });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (0);


/***/ }),

/***/ 66255:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// pkg/dist-src/index.js
var dist_src_exports = {};
__export(dist_src_exports, {
  request: () => request
});
module.exports = __toCommonJS(dist_src_exports);
var import_endpoint = __nccwpck_require__(54471);
var import_universal_user_agent = __nccwpck_require__(33843);

// pkg/dist-src/version.js
var VERSION = "8.4.1";

// pkg/dist-src/is-plain-object.js
function isPlainObject(value) {
  if (typeof value !== "object" || value === null)
    return false;
  if (Object.prototype.toString.call(value) !== "[object Object]")
    return false;
  const proto = Object.getPrototypeOf(value);
  if (proto === null)
    return true;
  const Ctor = Object.prototype.hasOwnProperty.call(proto, "constructor") && proto.constructor;
  return typeof Ctor === "function" && Ctor instanceof Ctor && Function.prototype.call(Ctor) === Function.prototype.call(value);
}

// pkg/dist-src/fetch-wrapper.js
var import_request_error = __nccwpck_require__(93708);

// pkg/dist-src/get-buffer-response.js
function getBufferResponse(response) {
  return response.arrayBuffer();
}

// pkg/dist-src/fetch-wrapper.js
function fetchWrapper(requestOptions) {
  var _a, _b, _c, _d;
  const log = requestOptions.request && requestOptions.request.log ? requestOptions.request.log : console;
  const parseSuccessResponseBody = ((_a = requestOptions.request) == null ? void 0 : _a.parseSuccessResponseBody) !== false;
  if (isPlainObject(requestOptions.body) || Array.isArray(requestOptions.body)) {
    requestOptions.body = JSON.stringify(requestOptions.body);
  }
  let headers = {};
  let status;
  let url;
  let { fetch } = globalThis;
  if ((_b = requestOptions.request) == null ? void 0 : _b.fetch) {
    fetch = requestOptions.request.fetch;
  }
  if (!fetch) {
    throw new Error(
      "fetch is not set. Please pass a fetch implementation as new Octokit({ request: { fetch }}). Learn more at https://github.com/octokit/octokit.js/#fetch-missing"
    );
  }
  return fetch(requestOptions.url, {
    method: requestOptions.method,
    body: requestOptions.body,
    redirect: (_c = requestOptions.request) == null ? void 0 : _c.redirect,
    headers: requestOptions.headers,
    signal: (_d = requestOptions.request) == null ? void 0 : _d.signal,
    // duplex must be set if request.body is ReadableStream or Async Iterables.
    // See https://fetch.spec.whatwg.org/#dom-requestinit-duplex.
    ...requestOptions.body && { duplex: "half" }
  }).then(async (response) => {
    url = response.url;
    status = response.status;
    for (const keyAndValue of response.headers) {
      headers[keyAndValue[0]] = keyAndValue[1];
    }
    if ("deprecation" in headers) {
      const matches = headers.link && headers.link.match(/<([^<>]+)>; rel="deprecation"/);
      const deprecationLink = matches && matches.pop();
      log.warn(
        `[@octokit/request] "${requestOptions.method} ${requestOptions.url}" is deprecated. It is scheduled to be removed on ${headers.sunset}${deprecationLink ? `. See ${deprecationLink}` : ""}`
      );
    }
    if (status === 204 || status === 205) {
      return;
    }
    if (requestOptions.method === "HEAD") {
      if (status < 400) {
        return;
      }
      throw new import_request_error.RequestError(response.statusText, status, {
        response: {
          url,
          status,
          headers,
          data: void 0
        },
        request: requestOptions
      });
    }
    if (status === 304) {
      throw new import_request_error.RequestError("Not modified", status, {
        response: {
          url,
          status,
          headers,
          data: await getResponseData(response)
        },
        request: requestOptions
      });
    }
    if (status >= 400) {
      const data = await getResponseData(response);
      const error = new import_request_error.RequestError(toErrorMessage(data), status, {
        response: {
          url,
          status,
          headers,
          data
        },
        request: requestOptions
      });
      throw error;
    }
    return parseSuccessResponseBody ? await getResponseData(response) : response.body;
  }).then((data) => {
    return {
      status,
      url,
      headers,
      data
    };
  }).catch((error) => {
    if (error instanceof import_request_error.RequestError)
      throw error;
    else if (error.name === "AbortError")
      throw error;
    let message = error.message;
    if (error.name === "TypeError" && "cause" in error) {
      if (error.cause instanceof Error) {
        message = error.cause.message;
      } else if (typeof error.cause === "string") {
        message = error.cause;
      }
    }
    throw new import_request_error.RequestError(message, 500, {
      request: requestOptions
    });
  });
}
async function getResponseData(response) {
  const contentType = response.headers.get("content-type");
  if (/application\/json/.test(contentType)) {
    return response.json().catch(() => response.text()).catch(() => "");
  }
  if (!contentType || /^text\/|charset=utf-8$/.test(contentType)) {
    return response.text();
  }
  return getBufferResponse(response);
}
function toErrorMessage(data) {
  if (typeof data === "string")
    return data;
  let suffix;
  if ("documentation_url" in data) {
    suffix = ` - ${data.documentation_url}`;
  } else {
    suffix = "";
  }
  if ("message" in data) {
    if (Array.isArray(data.errors)) {
      return `${data.message}: ${data.errors.map(JSON.stringify).join(", ")}${suffix}`;
    }
    return `${data.message}${suffix}`;
  }
  return `Unknown error: ${JSON.stringify(data)}`;
}

// pkg/dist-src/with-defaults.js
function withDefaults(oldEndpoint, newDefaults) {
  const endpoint2 = oldEndpoint.defaults(newDefaults);
  const newApi = function(route, parameters) {
    const endpointOptions = endpoint2.merge(route, parameters);
    if (!endpointOptions.request || !endpointOptions.request.hook) {
      return fetchWrapper(endpoint2.parse(endpointOptions));
    }
    const request2 = (route2, parameters2) => {
      return fetchWrapper(
        endpoint2.parse(endpoint2.merge(route2, parameters2))
      );
    };
    Object.assign(request2, {
      endpoint: endpoint2,
      defaults: withDefaults.bind(null, endpoint2)
    });
    return endpointOptions.request.hook(request2, endpointOptions);
  };
  return Object.assign(newApi, {
    endpoint: endpoint2,
    defaults: withDefaults.bind(null, endpoint2)
  });
}

// pkg/dist-src/index.js
var request = withDefaults(import_endpoint.endpoint, {
  headers: {
    "user-agent": `octokit-request.js/${VERSION} ${(0, import_universal_user_agent.getUserAgent)()}`
  }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (0);


/***/ }),

/***/ 18456:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.toMessageSignatureBundle = toMessageSignatureBundle;
exports.toDSSEBundle = toDSSEBundle;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const protobuf_specs_1 = __nccwpck_require__(19654);
const bundle_1 = __nccwpck_require__(37742);
// Message signature bundle - $case: 'messageSignature'
function toMessageSignatureBundle(options) {
    return {
        mediaType: options.certificateChain
            ? bundle_1.BUNDLE_V02_MEDIA_TYPE
            : bundle_1.BUNDLE_V03_MEDIA_TYPE,
        content: {
            $case: 'messageSignature',
            messageSignature: {
                messageDigest: {
                    algorithm: protobuf_specs_1.HashAlgorithm.SHA2_256,
                    digest: options.digest,
                },
                signature: options.signature,
            },
        },
        verificationMaterial: toVerificationMaterial(options),
    };
}
// DSSE envelope bundle - $case: 'dsseEnvelope'
function toDSSEBundle(options) {
    return {
        mediaType: options.certificateChain
            ? bundle_1.BUNDLE_V02_MEDIA_TYPE
            : bundle_1.BUNDLE_V03_MEDIA_TYPE,
        content: {
            $case: 'dsseEnvelope',
            dsseEnvelope: toEnvelope(options),
        },
        verificationMaterial: toVerificationMaterial(options),
    };
}
function toEnvelope(options) {
    return {
        payloadType: options.artifactType,
        payload: options.artifact,
        signatures: [toSignature(options)],
    };
}
function toSignature(options) {
    return {
        keyid: options.keyHint || '',
        sig: options.signature,
    };
}
// Verification material
function toVerificationMaterial(options) {
    return {
        content: toKeyContent(options),
        tlogEntries: [],
        timestampVerificationData: { rfc3161Timestamps: [] },
    };
}
function toKeyContent(options) {
    if (options.certificate) {
        if (options.certificateChain) {
            return {
                $case: 'x509CertificateChain',
                x509CertificateChain: {
                    certificates: [{ rawBytes: options.certificate }],
                },
            };
        }
        else {
            return {
                $case: 'certificate',
                certificate: { rawBytes: options.certificate },
            };
        }
    }
    else {
        return {
            $case: 'publicKey',
            publicKey: {
                hint: options.keyHint || '',
            },
        };
    }
}


/***/ }),

/***/ 37742:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BUNDLE_V03_MEDIA_TYPE = exports.BUNDLE_V03_LEGACY_MEDIA_TYPE = exports.BUNDLE_V02_MEDIA_TYPE = exports.BUNDLE_V01_MEDIA_TYPE = void 0;
exports.isBundleWithCertificateChain = isBundleWithCertificateChain;
exports.isBundleWithPublicKey = isBundleWithPublicKey;
exports.isBundleWithMessageSignature = isBundleWithMessageSignature;
exports.isBundleWithDsseEnvelope = isBundleWithDsseEnvelope;
exports.BUNDLE_V01_MEDIA_TYPE = 'application/vnd.dev.sigstore.bundle+json;version=0.1';
exports.BUNDLE_V02_MEDIA_TYPE = 'application/vnd.dev.sigstore.bundle+json;version=0.2';
exports.BUNDLE_V03_LEGACY_MEDIA_TYPE = 'application/vnd.dev.sigstore.bundle+json;version=0.3';
exports.BUNDLE_V03_MEDIA_TYPE = 'application/vnd.dev.sigstore.bundle.v0.3+json';
// Type guards for bundle variants.
function isBundleWithCertificateChain(b) {
    return b.verificationMaterial.content.$case === 'x509CertificateChain';
}
function isBundleWithPublicKey(b) {
    return b.verificationMaterial.content.$case === 'publicKey';
}
function isBundleWithMessageSignature(b) {
    return b.content.$case === 'messageSignature';
}
function isBundleWithDsseEnvelope(b) {
    return b.content.$case === 'dsseEnvelope';
}


/***/ }),

/***/ 47714:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ValidationError = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
class ValidationError extends Error {
    constructor(message, fields) {
        super(message);
        this.fields = fields;
    }
}
exports.ValidationError = ValidationError;


/***/ }),

/***/ 61040:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.isBundleV01 = exports.assertBundleV02 = exports.assertBundleV01 = exports.assertBundleLatest = exports.assertBundle = exports.envelopeToJSON = exports.envelopeFromJSON = exports.bundleToJSON = exports.bundleFromJSON = exports.ValidationError = exports.isBundleWithPublicKey = exports.isBundleWithMessageSignature = exports.isBundleWithDsseEnvelope = exports.isBundleWithCertificateChain = exports.BUNDLE_V03_MEDIA_TYPE = exports.BUNDLE_V03_LEGACY_MEDIA_TYPE = exports.BUNDLE_V02_MEDIA_TYPE = exports.BUNDLE_V01_MEDIA_TYPE = exports.toMessageSignatureBundle = exports.toDSSEBundle = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
var build_1 = __nccwpck_require__(18456);
Object.defineProperty(exports, "toDSSEBundle", ({ enumerable: true, get: function () { return build_1.toDSSEBundle; } }));
Object.defineProperty(exports, "toMessageSignatureBundle", ({ enumerable: true, get: function () { return build_1.toMessageSignatureBundle; } }));
var bundle_1 = __nccwpck_require__(37742);
Object.defineProperty(exports, "BUNDLE_V01_MEDIA_TYPE", ({ enumerable: true, get: function () { return bundle_1.BUNDLE_V01_MEDIA_TYPE; } }));
Object.defineProperty(exports, "BUNDLE_V02_MEDIA_TYPE", ({ enumerable: true, get: function () { return bundle_1.BUNDLE_V02_MEDIA_TYPE; } }));
Object.defineProperty(exports, "BUNDLE_V03_LEGACY_MEDIA_TYPE", ({ enumerable: true, get: function () { return bundle_1.BUNDLE_V03_LEGACY_MEDIA_TYPE; } }));
Object.defineProperty(exports, "BUNDLE_V03_MEDIA_TYPE", ({ enumerable: true, get: function () { return bundle_1.BUNDLE_V03_MEDIA_TYPE; } }));
Object.defineProperty(exports, "isBundleWithCertificateChain", ({ enumerable: true, get: function () { return bundle_1.isBundleWithCertificateChain; } }));
Object.defineProperty(exports, "isBundleWithDsseEnvelope", ({ enumerable: true, get: function () { return bundle_1.isBundleWithDsseEnvelope; } }));
Object.defineProperty(exports, "isBundleWithMessageSignature", ({ enumerable: true, get: function () { return bundle_1.isBundleWithMessageSignature; } }));
Object.defineProperty(exports, "isBundleWithPublicKey", ({ enumerable: true, get: function () { return bundle_1.isBundleWithPublicKey; } }));
var error_1 = __nccwpck_require__(47714);
Object.defineProperty(exports, "ValidationError", ({ enumerable: true, get: function () { return error_1.ValidationError; } }));
var serialized_1 = __nccwpck_require__(23404);
Object.defineProperty(exports, "bundleFromJSON", ({ enumerable: true, get: function () { return serialized_1.bundleFromJSON; } }));
Object.defineProperty(exports, "bundleToJSON", ({ enumerable: true, get: function () { return serialized_1.bundleToJSON; } }));
Object.defineProperty(exports, "envelopeFromJSON", ({ enumerable: true, get: function () { return serialized_1.envelopeFromJSON; } }));
Object.defineProperty(exports, "envelopeToJSON", ({ enumerable: true, get: function () { return serialized_1.envelopeToJSON; } }));
var validate_1 = __nccwpck_require__(9352);
Object.defineProperty(exports, "assertBundle", ({ enumerable: true, get: function () { return validate_1.assertBundle; } }));
Object.defineProperty(exports, "assertBundleLatest", ({ enumerable: true, get: function () { return validate_1.assertBundleLatest; } }));
Object.defineProperty(exports, "assertBundleV01", ({ enumerable: true, get: function () { return validate_1.assertBundleV01; } }));
Object.defineProperty(exports, "assertBundleV02", ({ enumerable: true, get: function () { return validate_1.assertBundleV02; } }));
Object.defineProperty(exports, "isBundleV01", ({ enumerable: true, get: function () { return validate_1.isBundleV01; } }));


/***/ }),

/***/ 23404:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.envelopeToJSON = exports.envelopeFromJSON = exports.bundleToJSON = exports.bundleFromJSON = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const protobuf_specs_1 = __nccwpck_require__(19654);
const bundle_1 = __nccwpck_require__(37742);
const validate_1 = __nccwpck_require__(9352);
const bundleFromJSON = (obj) => {
    const bundle = protobuf_specs_1.Bundle.fromJSON(obj);
    switch (bundle.mediaType) {
        case bundle_1.BUNDLE_V01_MEDIA_TYPE:
            (0, validate_1.assertBundleV01)(bundle);
            break;
        case bundle_1.BUNDLE_V02_MEDIA_TYPE:
            (0, validate_1.assertBundleV02)(bundle);
            break;
        default:
            (0, validate_1.assertBundleLatest)(bundle);
            break;
    }
    return bundle;
};
exports.bundleFromJSON = bundleFromJSON;
const bundleToJSON = (bundle) => {
    return protobuf_specs_1.Bundle.toJSON(bundle);
};
exports.bundleToJSON = bundleToJSON;
const envelopeFromJSON = (obj) => {
    return protobuf_specs_1.Envelope.fromJSON(obj);
};
exports.envelopeFromJSON = envelopeFromJSON;
const envelopeToJSON = (envelope) => {
    return protobuf_specs_1.Envelope.toJSON(envelope);
};
exports.envelopeToJSON = envelopeToJSON;


/***/ }),

/***/ 9352:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.assertBundle = assertBundle;
exports.assertBundleV01 = assertBundleV01;
exports.isBundleV01 = isBundleV01;
exports.assertBundleV02 = assertBundleV02;
exports.assertBundleLatest = assertBundleLatest;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const error_1 = __nccwpck_require__(47714);
// Performs basic validation of a Sigstore bundle to ensure that all required
// fields are populated. This is not a complete validation of the bundle, but
// rather a check that the bundle is in a valid state to be processed by the
// rest of the code.
function assertBundle(b) {
    const invalidValues = validateBundleBase(b);
    if (invalidValues.length > 0) {
        throw new error_1.ValidationError('invalid bundle', invalidValues);
    }
}
// Asserts that the given bundle conforms to the v0.1 bundle format.
function assertBundleV01(b) {
    const invalidValues = [];
    invalidValues.push(...validateBundleBase(b));
    invalidValues.push(...validateInclusionPromise(b));
    if (invalidValues.length > 0) {
        throw new error_1.ValidationError('invalid v0.1 bundle', invalidValues);
    }
}
// Type guard to determine if Bundle is a v0.1 bundle.
function isBundleV01(b) {
    try {
        assertBundleV01(b);
        return true;
    }
    catch (e) {
        return false;
    }
}
// Asserts that the given bundle conforms to the v0.2 bundle format.
function assertBundleV02(b) {
    const invalidValues = [];
    invalidValues.push(...validateBundleBase(b));
    invalidValues.push(...validateInclusionProof(b));
    if (invalidValues.length > 0) {
        throw new error_1.ValidationError('invalid v0.2 bundle', invalidValues);
    }
}
// Asserts that the given bundle conforms to the newest (0.3) bundle format.
function assertBundleLatest(b) {
    const invalidValues = [];
    invalidValues.push(...validateBundleBase(b));
    invalidValues.push(...validateInclusionProof(b));
    invalidValues.push(...validateNoCertificateChain(b));
    if (invalidValues.length > 0) {
        throw new error_1.ValidationError('invalid bundle', invalidValues);
    }
}
function validateBundleBase(b) {
    const invalidValues = [];
    // Media type validation
    if (b.mediaType === undefined ||
        (!b.mediaType.match(/^application\/vnd\.dev\.sigstore\.bundle\+json;version=\d\.\d/) &&
            !b.mediaType.match(/^application\/vnd\.dev\.sigstore\.bundle\.v\d\.\d\+json/))) {
        invalidValues.push('mediaType');
    }
    // Content-related validation
    if (b.content === undefined) {
        invalidValues.push('content');
    }
    else {
        switch (b.content.$case) {
            case 'messageSignature':
                if (b.content.messageSignature.messageDigest === undefined) {
                    invalidValues.push('content.messageSignature.messageDigest');
                }
                else {
                    if (b.content.messageSignature.messageDigest.digest.length === 0) {
                        invalidValues.push('content.messageSignature.messageDigest.digest');
                    }
                }
                if (b.content.messageSignature.signature.length === 0) {
                    invalidValues.push('content.messageSignature.signature');
                }
                break;
            case 'dsseEnvelope':
                if (b.content.dsseEnvelope.payload.length === 0) {
                    invalidValues.push('content.dsseEnvelope.payload');
                }
                if (b.content.dsseEnvelope.signatures.length !== 1) {
                    invalidValues.push('content.dsseEnvelope.signatures');
                }
                else {
                    if (b.content.dsseEnvelope.signatures[0].sig.length === 0) {
                        invalidValues.push('content.dsseEnvelope.signatures[0].sig');
                    }
                }
                break;
        }
    }
    // Verification material-related validation
    if (b.verificationMaterial === undefined) {
        invalidValues.push('verificationMaterial');
    }
    else {
        if (b.verificationMaterial.content === undefined) {
            invalidValues.push('verificationMaterial.content');
        }
        else {
            switch (b.verificationMaterial.content.$case) {
                case 'x509CertificateChain':
                    if (b.verificationMaterial.content.x509CertificateChain.certificates
                        .length === 0) {
                        invalidValues.push('verificationMaterial.content.x509CertificateChain.certificates');
                    }
                    b.verificationMaterial.content.x509CertificateChain.certificates.forEach((cert, i) => {
                        if (cert.rawBytes.length === 0) {
                            invalidValues.push(`verificationMaterial.content.x509CertificateChain.certificates[${i}].rawBytes`);
                        }
                    });
                    break;
                case 'certificate':
                    if (b.verificationMaterial.content.certificate.rawBytes.length === 0) {
                        invalidValues.push('verificationMaterial.content.certificate.rawBytes');
                    }
                    break;
            }
        }
        if (b.verificationMaterial.tlogEntries === undefined) {
            invalidValues.push('verificationMaterial.tlogEntries');
        }
        else {
            if (b.verificationMaterial.tlogEntries.length > 0) {
                b.verificationMaterial.tlogEntries.forEach((entry, i) => {
                    if (entry.logId === undefined) {
                        invalidValues.push(`verificationMaterial.tlogEntries[${i}].logId`);
                    }
                    if (entry.kindVersion === undefined) {
                        invalidValues.push(`verificationMaterial.tlogEntries[${i}].kindVersion`);
                    }
                });
            }
        }
    }
    return invalidValues;
}
// Necessary for V01 bundles
function validateInclusionPromise(b) {
    const invalidValues = [];
    if (b.verificationMaterial &&
        b.verificationMaterial.tlogEntries?.length > 0) {
        b.verificationMaterial.tlogEntries.forEach((entry, i) => {
            if (entry.inclusionPromise === undefined) {
                invalidValues.push(`verificationMaterial.tlogEntries[${i}].inclusionPromise`);
            }
        });
    }
    return invalidValues;
}
// Necessary for V02 and later bundles
function validateInclusionProof(b) {
    const invalidValues = [];
    if (b.verificationMaterial &&
        b.verificationMaterial.tlogEntries?.length > 0) {
        b.verificationMaterial.tlogEntries.forEach((entry, i) => {
            if (entry.inclusionProof === undefined) {
                invalidValues.push(`verificationMaterial.tlogEntries[${i}].inclusionProof`);
            }
            else {
                if (entry.inclusionProof.checkpoint === undefined) {
                    invalidValues.push(`verificationMaterial.tlogEntries[${i}].inclusionProof.checkpoint`);
                }
            }
        });
    }
    return invalidValues;
}
// Necessary for V03 and later bundles
function validateNoCertificateChain(b) {
    const invalidValues = [];
    /* istanbul ignore next */
    if (b.verificationMaterial?.content?.$case === 'x509CertificateChain') {
        invalidValues.push('verificationMaterial.content.$case');
    }
    return invalidValues;
}


/***/ }),

/***/ 11121:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ASN1TypeError = exports.ASN1ParseError = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
class ASN1ParseError extends Error {
}
exports.ASN1ParseError = ASN1ParseError;
class ASN1TypeError extends Error {
}
exports.ASN1TypeError = ASN1TypeError;


/***/ }),

/***/ 86027:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ASN1Obj = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
var obj_1 = __nccwpck_require__(50990);
Object.defineProperty(exports, "ASN1Obj", ({ enumerable: true, get: function () { return obj_1.ASN1Obj; } }));


/***/ }),

/***/ 84243:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.decodeLength = decodeLength;
exports.encodeLength = encodeLength;
const error_1 = __nccwpck_require__(11121);
// Decodes the length of a DER-encoded ANS.1 element from the supplied stream.
// https://learn.microsoft.com/en-us/windows/win32/seccertenroll/about-encoded-length-and-value-bytes
function decodeLength(stream) {
    const buf = stream.getUint8();
    // If the most significant bit is UNSET the length is just the value of the
    // byte.
    if ((buf & 0x80) === 0x00) {
        return buf;
    }
    // Otherwise, the lower 7 bits of the first byte indicate the number of bytes
    // that follow to encode the length.
    const byteCount = buf & 0x7f;
    // Ensure the encoded length can safely fit in a JS number.
    if (byteCount > 6) {
        throw new error_1.ASN1ParseError('length exceeds 6 byte limit');
    }
    // Iterate over the bytes that encode the length.
    let len = 0;
    for (let i = 0; i < byteCount; i++) {
        len = len * 256 + stream.getUint8();
    }
    // This is a valid ASN.1 length encoding, but we don't support it.
    if (len === 0) {
        throw new error_1.ASN1ParseError('indefinite length encoding not supported');
    }
    return len;
}
// Translates the supplied value to a DER-encoded length.
function encodeLength(len) {
    if (len < 128) {
        return Buffer.from([len]);
    }
    // Bitwise operations on large numbers are not supported in JS, so we need to
    // use BigInts.
    let val = BigInt(len);
    const bytes = [];
    while (val > 0n) {
        bytes.unshift(Number(val & 255n));
        val = val >> 8n;
    }
    return Buffer.from([0x80 | bytes.length, ...bytes]);
}


/***/ }),

/***/ 50990:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ASN1Obj = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const stream_1 = __nccwpck_require__(1673);
const error_1 = __nccwpck_require__(11121);
const length_1 = __nccwpck_require__(84243);
const parse_1 = __nccwpck_require__(81044);
const tag_1 = __nccwpck_require__(59343);
class ASN1Obj {
    constructor(tag, value, subs) {
        this.tag = tag;
        this.value = value;
        this.subs = subs;
    }
    // Constructs an ASN.1 object from a Buffer of DER-encoded bytes.
    static parseBuffer(buf) {
        return parseStream(new stream_1.ByteStream(buf));
    }
    toDER() {
        const valueStream = new stream_1.ByteStream();
        if (this.subs.length > 0) {
            for (const sub of this.subs) {
                valueStream.appendView(sub.toDER());
            }
        }
        else {
            valueStream.appendView(this.value);
        }
        const value = valueStream.buffer;
        // Concat tag/length/value
        const obj = new stream_1.ByteStream();
        obj.appendChar(this.tag.toDER());
        obj.appendView((0, length_1.encodeLength)(value.length));
        obj.appendView(value);
        return obj.buffer;
    }
    /////////////////////////////////////////////////////////////////////////////
    // Convenience methods for parsing ASN.1 primitives into JS types
    // Returns the ASN.1 object's value as a boolean. Throws an error if the
    // object is not a boolean.
    toBoolean() {
        if (!this.tag.isBoolean()) {
            throw new error_1.ASN1TypeError('not a boolean');
        }
        return (0, parse_1.parseBoolean)(this.value);
    }
    // Returns the ASN.1 object's value as a BigInt. Throws an error if the
    // object is not an integer.
    toInteger() {
        if (!this.tag.isInteger()) {
            throw new error_1.ASN1TypeError('not an integer');
        }
        return (0, parse_1.parseInteger)(this.value);
    }
    // Returns the ASN.1 object's value as an OID string. Throws an error if the
    // object is not an OID.
    toOID() {
        if (!this.tag.isOID()) {
            throw new error_1.ASN1TypeError('not an OID');
        }
        return (0, parse_1.parseOID)(this.value);
    }
    // Returns the ASN.1 object's value as a Date. Throws an error if the object
    // is not either a UTCTime or a GeneralizedTime.
    toDate() {
        switch (true) {
            case this.tag.isUTCTime():
                return (0, parse_1.parseTime)(this.value, true);
            case this.tag.isGeneralizedTime():
                return (0, parse_1.parseTime)(this.value, false);
            default:
                throw new error_1.ASN1TypeError('not a date');
        }
    }
    // Returns the ASN.1 object's value as a number[] where each number is the
    // value of a bit in the bit string. Throws an error if the object is not a
    // bit string.
    toBitString() {
        if (!this.tag.isBitString()) {
            throw new error_1.ASN1TypeError('not a bit string');
        }
        return (0, parse_1.parseBitString)(this.value);
    }
}
exports.ASN1Obj = ASN1Obj;
/////////////////////////////////////////////////////////////////////////////
// Internal stream parsing functions
function parseStream(stream) {
    // Parse tag, length, and value from stream
    const tag = new tag_1.ASN1Tag(stream.getUint8());
    const len = (0, length_1.decodeLength)(stream);
    const value = stream.slice(stream.position, len);
    const start = stream.position;
    let subs = [];
    // If the object is constructed, parse its children. Sometimes, children
    // are embedded in OCTESTRING objects, so we need to check those
    // for children as well.
    if (tag.constructed) {
        subs = collectSubs(stream, len);
    }
    else if (tag.isOctetString()) {
        // Attempt to parse children of OCTETSTRING objects. If anything fails,
        // assume the object is not constructed and treat as primitive.
        try {
            subs = collectSubs(stream, len);
        }
        catch (e) {
            // Fail silently and treat as primitive
        }
    }
    // If there are no children, move stream cursor to the end of the object
    if (subs.length === 0) {
        stream.seek(start + len);
    }
    return new ASN1Obj(tag, value, subs);
}
function collectSubs(stream, len) {
    // Calculate end of object content
    const end = stream.position + len;
    // Make sure there are enough bytes left in the stream. This should never
    // happen, cause it'll get caught when the stream is sliced in parseStream.
    // Leaving as an extra check just in case.
    /* istanbul ignore if */
    if (end > stream.length) {
        throw new error_1.ASN1ParseError('invalid length');
    }
    // Parse all children
    const subs = [];
    while (stream.position < end) {
        subs.push(parseStream(stream));
    }
    // When we're done parsing children, we should be at the end of the object
    if (stream.position !== end) {
        throw new error_1.ASN1ParseError('invalid length');
    }
    return subs;
}


/***/ }),

/***/ 81044:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.parseInteger = parseInteger;
exports.parseStringASCII = parseStringASCII;
exports.parseTime = parseTime;
exports.parseOID = parseOID;
exports.parseBoolean = parseBoolean;
exports.parseBitString = parseBitString;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const RE_TIME_SHORT_YEAR = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d{3})?Z$/;
const RE_TIME_LONG_YEAR = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d{3})?Z$/;
// Parse a BigInt from the DER-encoded buffer
// https://learn.microsoft.com/en-us/windows/win32/seccertenroll/about-integer
function parseInteger(buf) {
    let pos = 0;
    const end = buf.length;
    let val = buf[pos];
    const neg = val > 0x7f;
    // Consume any padding bytes
    const pad = neg ? 0xff : 0x00;
    while (val == pad && ++pos < end) {
        val = buf[pos];
    }
    // Calculate remaining bytes to read
    const len = end - pos;
    if (len === 0)
        return BigInt(neg ? -1 : 0);
    // Handle two's complement for negative numbers
    val = neg ? val - 256 : val;
    // Parse remaining bytes
    let n = BigInt(val);
    for (let i = pos + 1; i < end; ++i) {
        n = n * BigInt(256) + BigInt(buf[i]);
    }
    return n;
}
// Parse an ASCII string from the DER-encoded buffer
// https://learn.microsoft.com/en-us/windows/win32/seccertenroll/about-basic-types#boolean
function parseStringASCII(buf) {
    return buf.toString('ascii');
}
// Parse a Date from the DER-encoded buffer
// https://www.rfc-editor.org/rfc/rfc5280#section-4.1.2.5.1
function parseTime(buf, shortYear) {
    const timeStr = parseStringASCII(buf);
    // Parse the time string into matches - captured groups start at index 1
    const m = shortYear
        ? RE_TIME_SHORT_YEAR.exec(timeStr)
        : RE_TIME_LONG_YEAR.exec(timeStr);
    if (!m) {
        throw new Error('invalid time');
    }
    // Translate dates with a 2-digit year to 4 digits per the spec
    if (shortYear) {
        let year = Number(m[1]);
        year += year >= 50 ? 1900 : 2000;
        m[1] = year.toString();
    }
    // Translate to ISO8601 format and parse
    return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
}
// Parse an OID from the DER-encoded buffer
// https://learn.microsoft.com/en-us/windows/win32/seccertenroll/about-object-identifier
function parseOID(buf) {
    let pos = 0;
    const end = buf.length;
    // Consume first byte which encodes the first two OID components
    let n = buf[pos++];
    const first = Math.floor(n / 40);
    const second = n % 40;
    let oid = `${first}.${second}`;
    // Consume remaining bytes
    let val = 0;
    for (; pos < end; ++pos) {
        n = buf[pos];
        val = (val << 7) + (n & 0x7f);
        // If the left-most bit is NOT set, then this is the last byte in the
        // sequence and we can add the value to the OID and reset the accumulator
        if ((n & 0x80) === 0) {
            oid += `.${val}`;
            val = 0;
        }
    }
    return oid;
}
// Parse a boolean from the DER-encoded buffer
// https://learn.microsoft.com/en-us/windows/win32/seccertenroll/about-basic-types#boolean
function parseBoolean(buf) {
    return buf[0] !== 0;
}
// Parse a bit string from the DER-encoded buffer
// https://learn.microsoft.com/en-us/windows/win32/seccertenroll/about-bit-string
function parseBitString(buf) {
    // First byte tell us how many unused bits are in the last byte
    const unused = buf[0];
    const start = 1;
    const end = buf.length;
    const bits = [];
    for (let i = start; i < end; ++i) {
        const byte = buf[i];
        // The skip value is only used for the last byte
        const skip = i === end - 1 ? unused : 0;
        // Iterate over each bit in the byte (most significant first)
        for (let j = 7; j >= skip; --j) {
            // Read the bit and add it to the bit string
            bits.push((byte >> j) & 0x01);
        }
    }
    return bits;
}


/***/ }),

/***/ 59343:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ASN1Tag = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const error_1 = __nccwpck_require__(11121);
const UNIVERSAL_TAG = {
    BOOLEAN: 0x01,
    INTEGER: 0x02,
    BIT_STRING: 0x03,
    OCTET_STRING: 0x04,
    OBJECT_IDENTIFIER: 0x06,
    SEQUENCE: 0x10,
    SET: 0x11,
    PRINTABLE_STRING: 0x13,
    UTC_TIME: 0x17,
    GENERALIZED_TIME: 0x18,
};
const TAG_CLASS = {
    UNIVERSAL: 0x00,
    APPLICATION: 0x01,
    CONTEXT_SPECIFIC: 0x02,
    PRIVATE: 0x03,
};
// https://learn.microsoft.com/en-us/windows/win32/seccertenroll/about-encoded-tag-bytes
class ASN1Tag {
    constructor(enc) {
        // Bits 0 through 4 are the tag number
        this.number = enc & 0x1f;
        // Bit 5 is the constructed bit
        this.constructed = (enc & 0x20) === 0x20;
        // Bit 6 & 7 are the class
        this.class = enc >> 6;
        if (this.number === 0x1f) {
            throw new error_1.ASN1ParseError('long form tags not supported');
        }
        if (this.class === TAG_CLASS.UNIVERSAL && this.number === 0x00) {
            throw new error_1.ASN1ParseError('unsupported tag 0x00');
        }
    }
    isUniversal() {
        return this.class === TAG_CLASS.UNIVERSAL;
    }
    isContextSpecific(num) {
        const res = this.class === TAG_CLASS.CONTEXT_SPECIFIC;
        return num !== undefined ? res && this.number === num : res;
    }
    isBoolean() {
        return this.isUniversal() && this.number === UNIVERSAL_TAG.BOOLEAN;
    }
    isInteger() {
        return this.isUniversal() && this.number === UNIVERSAL_TAG.INTEGER;
    }
    isBitString() {
        return this.isUniversal() && this.number === UNIVERSAL_TAG.BIT_STRING;
    }
    isOctetString() {
        return this.isUniversal() && this.number === UNIVERSAL_TAG.OCTET_STRING;
    }
    isOID() {
        return (this.isUniversal() && this.number === UNIVERSAL_TAG.OBJECT_IDENTIFIER);
    }
    isUTCTime() {
        return this.isUniversal() && this.number === UNIVERSAL_TAG.UTC_TIME;
    }
    isGeneralizedTime() {
        return this.isUniversal() && this.number === UNIVERSAL_TAG.GENERALIZED_TIME;
    }
    toDER() {
        return this.number | (this.constructed ? 0x20 : 0x00) | (this.class << 6);
    }
}
exports.ASN1Tag = ASN1Tag;


/***/ }),

/***/ 69368:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.createPublicKey = createPublicKey;
exports.digest = digest;
exports.verify = verify;
exports.bufferEqual = bufferEqual;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const crypto_1 = __importDefault(__nccwpck_require__(76982));
function createPublicKey(key, type = 'spki') {
    if (typeof key === 'string') {
        return crypto_1.default.createPublicKey(key);
    }
    else {
        return crypto_1.default.createPublicKey({ key, format: 'der', type: type });
    }
}
function digest(algorithm, ...data) {
    const hash = crypto_1.default.createHash(algorithm);
    for (const d of data) {
        hash.update(d);
    }
    return hash.digest();
}
function verify(data, key, signature, algorithm) {
    // The try/catch is to work around an issue in Node 14.x where verify throws
    // an error in some scenarios if the signature is invalid.
    try {
        return crypto_1.default.verify(algorithm, data, key, signature);
    }
    catch (e) {
        /* istanbul ignore next */
        return false;
    }
}
function bufferEqual(a, b) {
    try {
        return crypto_1.default.timingSafeEqual(a, b);
    }
    catch {
        /* istanbul ignore next */
        return false;
    }
}


/***/ }),

/***/ 49032:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.preAuthEncoding = preAuthEncoding;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const PAE_PREFIX = 'DSSEv1';
// DSSE Pre-Authentication Encoding
function preAuthEncoding(payloadType, payload) {
    const prefix = [
        PAE_PREFIX,
        payloadType.length,
        payloadType,
        payload.length,
        '',
    ].join(' ');
    return Buffer.concat([Buffer.from(prefix, 'ascii'), payload]);
}


/***/ }),

/***/ 52788:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.base64Encode = base64Encode;
exports.base64Decode = base64Decode;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const BASE64_ENCODING = 'base64';
const UTF8_ENCODING = 'utf-8';
function base64Encode(str) {
    return Buffer.from(str, UTF8_ENCODING).toString(BASE64_ENCODING);
}
function base64Decode(str) {
    return Buffer.from(str, BASE64_ENCODING).toString(UTF8_ENCODING);
}


/***/ }),

/***/ 83917:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.X509SCTExtension = exports.X509Certificate = exports.EXTENSION_OID_SCT = exports.ByteStream = exports.RFC3161Timestamp = exports.pem = exports.json = exports.encoding = exports.dsse = exports.crypto = exports.ASN1Obj = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
var asn1_1 = __nccwpck_require__(86027);
Object.defineProperty(exports, "ASN1Obj", ({ enumerable: true, get: function () { return asn1_1.ASN1Obj; } }));
exports.crypto = __importStar(__nccwpck_require__(69368));
exports.dsse = __importStar(__nccwpck_require__(49032));
exports.encoding = __importStar(__nccwpck_require__(52788));
exports.json = __importStar(__nccwpck_require__(13327));
exports.pem = __importStar(__nccwpck_require__(1055));
var rfc3161_1 = __nccwpck_require__(20994);
Object.defineProperty(exports, "RFC3161Timestamp", ({ enumerable: true, get: function () { return rfc3161_1.RFC3161Timestamp; } }));
var stream_1 = __nccwpck_require__(1673);
Object.defineProperty(exports, "ByteStream", ({ enumerable: true, get: function () { return stream_1.ByteStream; } }));
var x509_1 = __nccwpck_require__(49358);
Object.defineProperty(exports, "EXTENSION_OID_SCT", ({ enumerable: true, get: function () { return x509_1.EXTENSION_OID_SCT; } }));
Object.defineProperty(exports, "X509Certificate", ({ enumerable: true, get: function () { return x509_1.X509Certificate; } }));
Object.defineProperty(exports, "X509SCTExtension", ({ enumerable: true, get: function () { return x509_1.X509SCTExtension; } }));


/***/ }),

/***/ 13327:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.canonicalize = canonicalize;
// JSON canonicalization per https://github.com/cyberphone/json-canonicalization
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function canonicalize(object) {
    let buffer = '';
    if (object === null || typeof object !== 'object' || object.toJSON != null) {
        // Primitives or toJSONable objects
        buffer += JSON.stringify(object);
    }
    else if (Array.isArray(object)) {
        // Array - maintain element order
        buffer += '[';
        let first = true;
        object.forEach((element) => {
            if (!first) {
                buffer += ',';
            }
            first = false;
            // recursive call
            buffer += canonicalize(element);
        });
        buffer += ']';
    }
    else {
        // Object - Sort properties before serializing
        buffer += '{';
        let first = true;
        Object.keys(object)
            .sort()
            .forEach((property) => {
            if (!first) {
                buffer += ',';
            }
            first = false;
            buffer += JSON.stringify(property);
            buffer += ':';
            // recursive call
            buffer += canonicalize(object[property]);
        });
        buffer += '}';
    }
    return buffer;
}


/***/ }),

/***/ 91817:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SHA2_HASH_ALGOS = exports.ECDSA_SIGNATURE_ALGOS = void 0;
exports.ECDSA_SIGNATURE_ALGOS = {
    '1.2.840.10045.4.3.1': 'sha224',
    '1.2.840.10045.4.3.2': 'sha256',
    '1.2.840.10045.4.3.3': 'sha384',
    '1.2.840.10045.4.3.4': 'sha512',
};
exports.SHA2_HASH_ALGOS = {
    '2.16.840.1.101.3.4.2.1': 'sha256',
    '2.16.840.1.101.3.4.2.2': 'sha384',
    '2.16.840.1.101.3.4.2.3': 'sha512',
};


/***/ }),

/***/ 1055:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.toDER = toDER;
exports.fromDER = fromDER;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const PEM_HEADER = /-----BEGIN (.*)-----/;
const PEM_FOOTER = /-----END (.*)-----/;
function toDER(certificate) {
    let der = '';
    certificate.split('\n').forEach((line) => {
        if (line.match(PEM_HEADER) || line.match(PEM_FOOTER)) {
            return;
        }
        der += line;
    });
    return Buffer.from(der, 'base64');
}
// Translates a DER-encoded buffer into a PEM-encoded string. Standard PEM
// encoding dictates that each certificate should have a trailing newline after
// the footer.
function fromDER(certificate, type = 'CERTIFICATE') {
    // Base64-encode the certificate.
    const der = certificate.toString('base64');
    // Split the certificate into lines of 64 characters.
    const lines = der.match(/.{1,64}/g) || '';
    return [`-----BEGIN ${type}-----`, ...lines, `-----END ${type}-----`]
        .join('\n')
        .concat('\n');
}


/***/ }),

/***/ 97512:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RFC3161TimestampVerificationError = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
class RFC3161TimestampVerificationError extends Error {
}
exports.RFC3161TimestampVerificationError = RFC3161TimestampVerificationError;


/***/ }),

/***/ 20994:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RFC3161Timestamp = void 0;
var timestamp_1 = __nccwpck_require__(92714);
Object.defineProperty(exports, "RFC3161Timestamp", ({ enumerable: true, get: function () { return timestamp_1.RFC3161Timestamp; } }));


/***/ }),

/***/ 92714:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RFC3161Timestamp = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const asn1_1 = __nccwpck_require__(86027);
const crypto = __importStar(__nccwpck_require__(69368));
const oid_1 = __nccwpck_require__(91817);
const error_1 = __nccwpck_require__(97512);
const tstinfo_1 = __nccwpck_require__(62925);
const OID_PKCS9_CONTENT_TYPE_SIGNED_DATA = '1.2.840.113549.1.7.2';
const OID_PKCS9_CONTENT_TYPE_TSTINFO = '1.2.840.113549.1.9.16.1.4';
const OID_PKCS9_MESSAGE_DIGEST_KEY = '1.2.840.113549.1.9.4';
class RFC3161Timestamp {
    constructor(asn1) {
        this.root = asn1;
    }
    static parse(der) {
        const asn1 = asn1_1.ASN1Obj.parseBuffer(der);
        return new RFC3161Timestamp(asn1);
    }
    get status() {
        return this.pkiStatusInfoObj.subs[0].toInteger();
    }
    get contentType() {
        return this.contentTypeObj.toOID();
    }
    get eContentType() {
        return this.eContentTypeObj.toOID();
    }
    get signingTime() {
        return this.tstInfo.genTime;
    }
    get signerIssuer() {
        return this.signerSidObj.subs[0].value;
    }
    get signerSerialNumber() {
        return this.signerSidObj.subs[1].value;
    }
    get signerDigestAlgorithm() {
        const oid = this.signerDigestAlgorithmObj.subs[0].toOID();
        return oid_1.SHA2_HASH_ALGOS[oid];
    }
    get signatureAlgorithm() {
        const oid = this.signatureAlgorithmObj.subs[0].toOID();
        return oid_1.ECDSA_SIGNATURE_ALGOS[oid];
    }
    get signatureValue() {
        return this.signatureValueObj.value;
    }
    get tstInfo() {
        // Need to unpack tstInfo from an OCTET STRING
        return new tstinfo_1.TSTInfo(this.eContentObj.subs[0].subs[0]);
    }
    verify(data, publicKey) {
        if (!this.timeStampTokenObj) {
            throw new error_1.RFC3161TimestampVerificationError('timeStampToken is missing');
        }
        // Check for expected ContentInfo content type
        if (this.contentType !== OID_PKCS9_CONTENT_TYPE_SIGNED_DATA) {
            throw new error_1.RFC3161TimestampVerificationError(`incorrect content type: ${this.contentType}`);
        }
        // Check for expected encapsulated content type
        if (this.eContentType !== OID_PKCS9_CONTENT_TYPE_TSTINFO) {
            throw new error_1.RFC3161TimestampVerificationError(`incorrect encapsulated content type: ${this.eContentType}`);
        }
        // Check that the tstInfo references the correct artifact
        this.tstInfo.verify(data);
        // Check that the signed message digest matches the tstInfo
        this.verifyMessageDigest();
        // Check that the signature is valid for the signed attributes
        this.verifySignature(publicKey);
    }
    verifyMessageDigest() {
        // Check that the tstInfo matches the signed data
        const tstInfoDigest = crypto.digest(this.signerDigestAlgorithm, this.tstInfo.raw);
        const expectedDigest = this.messageDigestAttributeObj.subs[1].subs[0].value;
        if (!crypto.bufferEqual(tstInfoDigest, expectedDigest)) {
            throw new error_1.RFC3161TimestampVerificationError('signed data does not match tstInfo');
        }
    }
    verifySignature(key) {
        // Encode the signed attributes for verification
        const signedAttrs = this.signedAttrsObj.toDER();
        signedAttrs[0] = 0x31; // Change context-specific tag to SET
        // Check that the signature is valid for the signed attributes
        const verified = crypto.verify(signedAttrs, key, this.signatureValue, this.signatureAlgorithm);
        if (!verified) {
            throw new error_1.RFC3161TimestampVerificationError('signature verification failed');
        }
    }
    // https://www.rfc-editor.org/rfc/rfc3161#section-2.4.2
    get pkiStatusInfoObj() {
        // pkiStatusInfo is the first element of the timestamp response sequence
        return this.root.subs[0];
    }
    // https://www.rfc-editor.org/rfc/rfc3161#section-2.4.2
    get timeStampTokenObj() {
        // timeStampToken is the first element of the timestamp response sequence
        return this.root.subs[1];
    }
    // https://datatracker.ietf.org/doc/html/rfc5652#section-3
    get contentTypeObj() {
        return this.timeStampTokenObj.subs[0];
    }
    // https://www.rfc-editor.org/rfc/rfc5652#section-3
    get signedDataObj() {
        const obj = this.timeStampTokenObj.subs.find((sub) => sub.tag.isContextSpecific(0x00));
        return obj.subs[0];
    }
    // https://datatracker.ietf.org/doc/html/rfc5652#section-5.1
    get encapContentInfoObj() {
        return this.signedDataObj.subs[2];
    }
    // https://datatracker.ietf.org/doc/html/rfc5652#section-5.1
    get signerInfosObj() {
        // SignerInfos is the last element of the signed data sequence
        const sd = this.signedDataObj;
        return sd.subs[sd.subs.length - 1];
    }
    // https://www.rfc-editor.org/rfc/rfc5652#section-5.1
    get signerInfoObj() {
        // Only supporting one signer
        return this.signerInfosObj.subs[0];
    }
    // https://datatracker.ietf.org/doc/html/rfc5652#section-5.2
    get eContentTypeObj() {
        return this.encapContentInfoObj.subs[0];
    }
    // https://datatracker.ietf.org/doc/html/rfc5652#section-5.2
    get eContentObj() {
        return this.encapContentInfoObj.subs[1];
    }
    // https://datatracker.ietf.org/doc/html/rfc5652#section-5.3
    get signedAttrsObj() {
        const signedAttrs = this.signerInfoObj.subs.find((sub) => sub.tag.isContextSpecific(0x00));
        return signedAttrs;
    }
    // https://datatracker.ietf.org/doc/html/rfc5652#section-5.3
    get messageDigestAttributeObj() {
        const messageDigest = this.signedAttrsObj.subs.find((sub) => sub.subs[0].tag.isOID() &&
            sub.subs[0].toOID() === OID_PKCS9_MESSAGE_DIGEST_KEY);
        return messageDigest;
    }
    // https://datatracker.ietf.org/doc/html/rfc5652#section-5.3
    get signerSidObj() {
        return this.signerInfoObj.subs[1];
    }
    // https://datatracker.ietf.org/doc/html/rfc5652#section-5.3
    get signerDigestAlgorithmObj() {
        // Signature is the 2nd element of the signerInfoObj object
        return this.signerInfoObj.subs[2];
    }
    // https://datatracker.ietf.org/doc/html/rfc5652#section-5.3
    get signatureAlgorithmObj() {
        // Signature is the 4th element of the signerInfoObj object
        return this.signerInfoObj.subs[4];
    }
    // https://datatracker.ietf.org/doc/html/rfc5652#section-5.3
    get signatureValueObj() {
        // Signature is the 6th element of the signerInfoObj object
        return this.signerInfoObj.subs[5];
    }
}
exports.RFC3161Timestamp = RFC3161Timestamp;


/***/ }),

/***/ 62925:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TSTInfo = void 0;
const crypto = __importStar(__nccwpck_require__(69368));
const oid_1 = __nccwpck_require__(91817);
const error_1 = __nccwpck_require__(97512);
class TSTInfo {
    constructor(asn1) {
        this.root = asn1;
    }
    get version() {
        return this.root.subs[0].toInteger();
    }
    get genTime() {
        return this.root.subs[4].toDate();
    }
    get messageImprintHashAlgorithm() {
        const oid = this.messageImprintObj.subs[0].subs[0].toOID();
        return oid_1.SHA2_HASH_ALGOS[oid];
    }
    get messageImprintHashedMessage() {
        return this.messageImprintObj.subs[1].value;
    }
    get raw() {
        return this.root.toDER();
    }
    verify(data) {
        const digest = crypto.digest(this.messageImprintHashAlgorithm, data);
        if (!crypto.bufferEqual(digest, this.messageImprintHashedMessage)) {
            throw new error_1.RFC3161TimestampVerificationError('message imprint does not match artifact');
        }
    }
    // https://www.rfc-editor.org/rfc/rfc3161#section-2.4.2
    get messageImprintObj() {
        return this.root.subs[2];
    }
}
exports.TSTInfo = TSTInfo;


/***/ }),

/***/ 1673:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ByteStream = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
class StreamError extends Error {
}
class ByteStream {
    constructor(buffer) {
        this.start = 0;
        if (buffer) {
            this.buf = buffer;
            this.view = Buffer.from(buffer);
        }
        else {
            this.buf = new ArrayBuffer(0);
            this.view = Buffer.from(this.buf);
        }
    }
    get buffer() {
        return this.view.subarray(0, this.start);
    }
    get length() {
        return this.view.byteLength;
    }
    get position() {
        return this.start;
    }
    seek(position) {
        this.start = position;
    }
    // Returns a Buffer containing the specified number of bytes starting at the
    // given start position.
    slice(start, len) {
        const end = start + len;
        if (end > this.length) {
            throw new StreamError('request past end of buffer');
        }
        return this.view.subarray(start, end);
    }
    appendChar(char) {
        this.ensureCapacity(1);
        this.view[this.start] = char;
        this.start += 1;
    }
    appendUint16(num) {
        this.ensureCapacity(2);
        const value = new Uint16Array([num]);
        const view = new Uint8Array(value.buffer);
        this.view[this.start] = view[1];
        this.view[this.start + 1] = view[0];
        this.start += 2;
    }
    appendUint24(num) {
        this.ensureCapacity(3);
        const value = new Uint32Array([num]);
        const view = new Uint8Array(value.buffer);
        this.view[this.start] = view[2];
        this.view[this.start + 1] = view[1];
        this.view[this.start + 2] = view[0];
        this.start += 3;
    }
    appendView(view) {
        this.ensureCapacity(view.length);
        this.view.set(view, this.start);
        this.start += view.length;
    }
    getBlock(size) {
        if (size <= 0) {
            return Buffer.alloc(0);
        }
        if (this.start + size > this.view.length) {
            throw new Error('request past end of buffer');
        }
        const result = this.view.subarray(this.start, this.start + size);
        this.start += size;
        return result;
    }
    getUint8() {
        return this.getBlock(1)[0];
    }
    getUint16() {
        const block = this.getBlock(2);
        return (block[0] << 8) | block[1];
    }
    ensureCapacity(size) {
        if (this.start + size > this.view.byteLength) {
            const blockSize = ByteStream.BLOCK_SIZE + (size > ByteStream.BLOCK_SIZE ? size : 0);
            this.realloc(this.view.byteLength + blockSize);
        }
    }
    realloc(size) {
        const newArray = new ArrayBuffer(size);
        const newView = Buffer.from(newArray);
        // Copy the old buffer into the new one
        newView.set(this.view);
        this.buf = newArray;
        this.view = newView;
    }
}
exports.ByteStream = ByteStream;
ByteStream.BLOCK_SIZE = 1024;


/***/ }),

/***/ 83566:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.X509Certificate = exports.EXTENSION_OID_SCT = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const asn1_1 = __nccwpck_require__(86027);
const crypto = __importStar(__nccwpck_require__(69368));
const oid_1 = __nccwpck_require__(91817);
const pem = __importStar(__nccwpck_require__(1055));
const ext_1 = __nccwpck_require__(96389);
const EXTENSION_OID_SUBJECT_KEY_ID = '2.5.29.14';
const EXTENSION_OID_KEY_USAGE = '2.5.29.15';
const EXTENSION_OID_SUBJECT_ALT_NAME = '2.5.29.17';
const EXTENSION_OID_BASIC_CONSTRAINTS = '2.5.29.19';
const EXTENSION_OID_AUTHORITY_KEY_ID = '2.5.29.35';
exports.EXTENSION_OID_SCT = '1.3.6.1.4.1.11129.2.4.2';
class X509Certificate {
    constructor(asn1) {
        this.root = asn1;
    }
    static parse(cert) {
        const der = typeof cert === 'string' ? pem.toDER(cert) : cert;
        const asn1 = asn1_1.ASN1Obj.parseBuffer(der);
        return new X509Certificate(asn1);
    }
    get tbsCertificate() {
        return this.tbsCertificateObj;
    }
    get version() {
        // version number is the first element of the version context specific tag
        const ver = this.versionObj.subs[0].toInteger();
        return `v${(ver + BigInt(1)).toString()}`;
    }
    get serialNumber() {
        return this.serialNumberObj.value;
    }
    get notBefore() {
        // notBefore is the first element of the validity sequence
        return this.validityObj.subs[0].toDate();
    }
    get notAfter() {
        // notAfter is the second element of the validity sequence
        return this.validityObj.subs[1].toDate();
    }
    get issuer() {
        return this.issuerObj.value;
    }
    get subject() {
        return this.subjectObj.value;
    }
    get publicKey() {
        return this.subjectPublicKeyInfoObj.toDER();
    }
    get signatureAlgorithm() {
        const oid = this.signatureAlgorithmObj.subs[0].toOID();
        return oid_1.ECDSA_SIGNATURE_ALGOS[oid];
    }
    get signatureValue() {
        // Signature value is a bit string, so we need to skip the first byte
        return this.signatureValueObj.value.subarray(1);
    }
    get subjectAltName() {
        const ext = this.extSubjectAltName;
        return ext?.uri || /* istanbul ignore next */ ext?.rfc822Name;
    }
    get extensions() {
        // The extension list is the first (and only) element of the extensions
        // context specific tag
        /* istanbul ignore next */
        const extSeq = this.extensionsObj?.subs[0];
        /* istanbul ignore next */
        return extSeq?.subs || [];
    }
    get extKeyUsage() {
        const ext = this.findExtension(EXTENSION_OID_KEY_USAGE);
        return ext ? new ext_1.X509KeyUsageExtension(ext) : undefined;
    }
    get extBasicConstraints() {
        const ext = this.findExtension(EXTENSION_OID_BASIC_CONSTRAINTS);
        return ext ? new ext_1.X509BasicConstraintsExtension(ext) : undefined;
    }
    get extSubjectAltName() {
        const ext = this.findExtension(EXTENSION_OID_SUBJECT_ALT_NAME);
        return ext ? new ext_1.X509SubjectAlternativeNameExtension(ext) : undefined;
    }
    get extAuthorityKeyID() {
        const ext = this.findExtension(EXTENSION_OID_AUTHORITY_KEY_ID);
        return ext ? new ext_1.X509AuthorityKeyIDExtension(ext) : undefined;
    }
    get extSubjectKeyID() {
        const ext = this.findExtension(EXTENSION_OID_SUBJECT_KEY_ID);
        return ext
            ? new ext_1.X509SubjectKeyIDExtension(ext)
            : /* istanbul ignore next */ undefined;
    }
    get extSCT() {
        const ext = this.findExtension(exports.EXTENSION_OID_SCT);
        return ext ? new ext_1.X509SCTExtension(ext) : undefined;
    }
    get isCA() {
        const ca = this.extBasicConstraints?.isCA || false;
        // If the KeyUsage extension is present, keyCertSign must be set
        if (this.extKeyUsage) {
            return ca && this.extKeyUsage.keyCertSign;
        }
        // TODO: test coverage for this case
        /* istanbul ignore next */
        return ca;
    }
    extension(oid) {
        const ext = this.findExtension(oid);
        return ext ? new ext_1.X509Extension(ext) : undefined;
    }
    verify(issuerCertificate) {
        // Use the issuer's public key if provided, otherwise use the subject's
        const publicKey = issuerCertificate?.publicKey || this.publicKey;
        const key = crypto.createPublicKey(publicKey);
        return crypto.verify(this.tbsCertificate.toDER(), key, this.signatureValue, this.signatureAlgorithm);
    }
    validForDate(date) {
        return this.notBefore <= date && date <= this.notAfter;
    }
    equals(other) {
        return this.root.toDER().equals(other.root.toDER());
    }
    // Creates a copy of the certificate with a new buffer
    clone() {
        const der = this.root.toDER();
        const clone = Buffer.alloc(der.length);
        der.copy(clone);
        return X509Certificate.parse(clone);
    }
    findExtension(oid) {
        // Find the extension with the given OID. The OID will always be the first
        // element of the extension sequence
        return this.extensions.find((ext) => ext.subs[0].toOID() === oid);
    }
    /////////////////////////////////////////////////////////////////////////////
    // The following properties use the documented x509 structure to locate the
    // desired ASN.1 object
    // https://www.rfc-editor.org/rfc/rfc5280#section-4.1
    // https://www.rfc-editor.org/rfc/rfc5280#section-4.1.1.1
    get tbsCertificateObj() {
        // tbsCertificate is the first element of the certificate sequence
        return this.root.subs[0];
    }
    // https://www.rfc-editor.org/rfc/rfc5280#section-4.1.1.2
    get signatureAlgorithmObj() {
        // signatureAlgorithm is the second element of the certificate sequence
        return this.root.subs[1];
    }
    // https://www.rfc-editor.org/rfc/rfc5280#section-4.1.1.3
    get signatureValueObj() {
        // signatureValue is the third element of the certificate sequence
        return this.root.subs[2];
    }
    // https://www.rfc-editor.org/rfc/rfc5280#section-4.1.2.1
    get versionObj() {
        // version is the first element of the tbsCertificate sequence
        return this.tbsCertificateObj.subs[0];
    }
    // https://www.rfc-editor.org/rfc/rfc5280#section-4.1.2.2
    get serialNumberObj() {
        // serialNumber is the second element of the tbsCertificate sequence
        return this.tbsCertificateObj.subs[1];
    }
    // https://www.rfc-editor.org/rfc/rfc5280#section-4.1.2.4
    get issuerObj() {
        // issuer is the fourth element of the tbsCertificate sequence
        return this.tbsCertificateObj.subs[3];
    }
    // https://www.rfc-editor.org/rfc/rfc5280#section-4.1.2.5
    get validityObj() {
        // version is the fifth element of the tbsCertificate sequence
        return this.tbsCertificateObj.subs[4];
    }
    // https://www.rfc-editor.org/rfc/rfc5280#section-4.1.2.6
    get subjectObj() {
        // subject is the sixth element of the tbsCertificate sequence
        return this.tbsCertificateObj.subs[5];
    }
    // https://www.rfc-editor.org/rfc/rfc5280#section-4.1.2.7
    get subjectPublicKeyInfoObj() {
        // subjectPublicKeyInfo is the seventh element of the tbsCertificate sequence
        return this.tbsCertificateObj.subs[6];
    }
    // Extensions can't be located by index because their position varies. Instead,
    // we need to find the extensions context specific tag
    // https://www.rfc-editor.org/rfc/rfc5280#section-4.1.2.9
    get extensionsObj() {
        return this.tbsCertificateObj.subs.find((sub) => sub.tag.isContextSpecific(0x03));
    }
}
exports.X509Certificate = X509Certificate;


/***/ }),

/***/ 96389:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.X509SCTExtension = exports.X509SubjectKeyIDExtension = exports.X509AuthorityKeyIDExtension = exports.X509SubjectAlternativeNameExtension = exports.X509KeyUsageExtension = exports.X509BasicConstraintsExtension = exports.X509Extension = void 0;
const stream_1 = __nccwpck_require__(1673);
const sct_1 = __nccwpck_require__(6144);
// https://www.rfc-editor.org/rfc/rfc5280#section-4.1
class X509Extension {
    constructor(asn1) {
        this.root = asn1;
    }
    get oid() {
        return this.root.subs[0].toOID();
    }
    get critical() {
        // The critical field is optional and will be the second element of the
        // extension sequence if present. Default to false if not present.
        return this.root.subs.length === 3 ? this.root.subs[1].toBoolean() : false;
    }
    get value() {
        return this.extnValueObj.value;
    }
    get valueObj() {
        return this.extnValueObj;
    }
    get extnValueObj() {
        // The extnValue field will be the last element of the extension sequence
        return this.root.subs[this.root.subs.length - 1];
    }
}
exports.X509Extension = X509Extension;
// https://www.rfc-editor.org/rfc/rfc5280#section-4.2.1.9
class X509BasicConstraintsExtension extends X509Extension {
    get isCA() {
        return this.sequence.subs[0]?.toBoolean() ?? false;
    }
    get pathLenConstraint() {
        return this.sequence.subs.length > 1
            ? this.sequence.subs[1].toInteger()
            : undefined;
    }
    // The extnValue field contains a single sequence wrapping the isCA and
    // pathLenConstraint.
    get sequence() {
        return this.extnValueObj.subs[0];
    }
}
exports.X509BasicConstraintsExtension = X509BasicConstraintsExtension;
// https://www.rfc-editor.org/rfc/rfc5280#section-4.2.1.3
class X509KeyUsageExtension extends X509Extension {
    get digitalSignature() {
        return this.bitString[0] === 1;
    }
    get keyCertSign() {
        return this.bitString[5] === 1;
    }
    get crlSign() {
        return this.bitString[6] === 1;
    }
    // The extnValue field contains a single bit string which is a bit mask
    // indicating which key usages are enabled.
    get bitString() {
        return this.extnValueObj.subs[0].toBitString();
    }
}
exports.X509KeyUsageExtension = X509KeyUsageExtension;
// https://www.rfc-editor.org/rfc/rfc5280#section-4.2.1.6
class X509SubjectAlternativeNameExtension extends X509Extension {
    get rfc822Name() {
        return this.findGeneralName(0x01)?.value.toString('ascii');
    }
    get uri() {
        return this.findGeneralName(0x06)?.value.toString('ascii');
    }
    // Retrieve the value of an otherName with the given OID.
    otherName(oid) {
        const otherName = this.findGeneralName(0x00);
        if (otherName === undefined) {
            return undefined;
        }
        // The otherName is a sequence containing an OID and a value.
        // Need to check that the OID matches the one we're looking for.
        const otherNameOID = otherName.subs[0].toOID();
        if (otherNameOID !== oid) {
            return undefined;
        }
        // The otherNameValue is a sequence containing the actual value.
        const otherNameValue = otherName.subs[1];
        return otherNameValue.subs[0].value.toString('ascii');
    }
    findGeneralName(tag) {
        return this.generalNames.find((gn) => gn.tag.isContextSpecific(tag));
    }
    // The extnValue field contains a sequence of GeneralNames.
    get generalNames() {
        return this.extnValueObj.subs[0].subs;
    }
}
exports.X509SubjectAlternativeNameExtension = X509SubjectAlternativeNameExtension;
// https://www.rfc-editor.org/rfc/rfc5280#section-4.2.1.1
class X509AuthorityKeyIDExtension extends X509Extension {
    get keyIdentifier() {
        return this.findSequenceMember(0x00)?.value;
    }
    findSequenceMember(tag) {
        return this.sequence.subs.find((el) => el.tag.isContextSpecific(tag));
    }
    // The extnValue field contains a single sequence wrapping the keyIdentifier
    get sequence() {
        return this.extnValueObj.subs[0];
    }
}
exports.X509AuthorityKeyIDExtension = X509AuthorityKeyIDExtension;
// https://www.rfc-editor.org/rfc/rfc5280#section-4.2.1.2
class X509SubjectKeyIDExtension extends X509Extension {
    get keyIdentifier() {
        return this.extnValueObj.subs[0].value;
    }
}
exports.X509SubjectKeyIDExtension = X509SubjectKeyIDExtension;
// https://www.rfc-editor.org/rfc/rfc6962#section-3.3
class X509SCTExtension extends X509Extension {
    constructor(asn1) {
        super(asn1);
    }
    get signedCertificateTimestamps() {
        const buf = this.extnValueObj.subs[0].value;
        const stream = new stream_1.ByteStream(buf);
        // The overall list length is encoded in the first two bytes -- note this
        // is the length of the list in bytes, NOT the number of SCTs in the list
        const end = stream.getUint16() + 2;
        const sctList = [];
        while (stream.position < end) {
            // Read the length of the next SCT
            const sctLength = stream.getUint16();
            // Slice out the bytes for the next SCT and parse it
            const sct = stream.getBlock(sctLength);
            sctList.push(sct_1.SignedCertificateTimestamp.parse(sct));
        }
        if (stream.position !== end) {
            throw new Error('SCT list length does not match actual length');
        }
        return sctList;
    }
}
exports.X509SCTExtension = X509SCTExtension;


/***/ }),

/***/ 49358:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.X509SCTExtension = exports.X509Certificate = exports.EXTENSION_OID_SCT = void 0;
var cert_1 = __nccwpck_require__(83566);
Object.defineProperty(exports, "EXTENSION_OID_SCT", ({ enumerable: true, get: function () { return cert_1.EXTENSION_OID_SCT; } }));
Object.defineProperty(exports, "X509Certificate", ({ enumerable: true, get: function () { return cert_1.X509Certificate; } }));
var ext_1 = __nccwpck_require__(96389);
Object.defineProperty(exports, "X509SCTExtension", ({ enumerable: true, get: function () { return ext_1.X509SCTExtension; } }));


/***/ }),

/***/ 6144:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SignedCertificateTimestamp = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const crypto = __importStar(__nccwpck_require__(69368));
const stream_1 = __nccwpck_require__(1673);
class SignedCertificateTimestamp {
    constructor(options) {
        this.version = options.version;
        this.logID = options.logID;
        this.timestamp = options.timestamp;
        this.extensions = options.extensions;
        this.hashAlgorithm = options.hashAlgorithm;
        this.signatureAlgorithm = options.signatureAlgorithm;
        this.signature = options.signature;
    }
    get datetime() {
        return new Date(Number(this.timestamp.readBigInt64BE()));
    }
    // Returns the hash algorithm used to generate the SCT's signature.
    // https://www.rfc-editor.org/rfc/rfc5246#section-7.4.1.4.1
    get algorithm() {
        switch (this.hashAlgorithm) {
            /* istanbul ignore next */
            case 0:
                return 'none';
            /* istanbul ignore next */
            case 1:
                return 'md5';
            /* istanbul ignore next */
            case 2:
                return 'sha1';
            /* istanbul ignore next */
            case 3:
                return 'sha224';
            case 4:
                return 'sha256';
            /* istanbul ignore next */
            case 5:
                return 'sha384';
            /* istanbul ignore next */
            case 6:
                return 'sha512';
            /* istanbul ignore next */
            default:
                return 'unknown';
        }
    }
    verify(preCert, key) {
        // Assemble the digitally-signed struct (the data over which the signature
        // was generated).
        // https://www.rfc-editor.org/rfc/rfc6962#section-3.2
        const stream = new stream_1.ByteStream();
        stream.appendChar(this.version);
        stream.appendChar(0x00); // SignatureType = certificate_timestamp(0)
        stream.appendView(this.timestamp);
        stream.appendUint16(0x01); // LogEntryType = precert_entry(1)
        stream.appendView(preCert);
        stream.appendUint16(this.extensions.byteLength);
        /* istanbul ignore next - extensions are very uncommon */
        if (this.extensions.byteLength > 0) {
            stream.appendView(this.extensions);
        }
        return crypto.verify(stream.buffer, key, this.signature, this.algorithm);
    }
    // Parses a SignedCertificateTimestamp from a buffer. SCTs are encoded using
    // TLS encoding which means the fields and lengths of most fields are
    // specified as part of the SCT and TLS specs.
    // https://www.rfc-editor.org/rfc/rfc6962#section-3.2
    // https://www.rfc-editor.org/rfc/rfc5246#section-7.4.1.4.1
    static parse(buf) {
        const stream = new stream_1.ByteStream(buf);
        // Version - enum { v1(0), (255) }
        const version = stream.getUint8();
        // Log ID  - struct { opaque key_id[32]; }
        const logID = stream.getBlock(32);
        // Timestamp - uint64
        const timestamp = stream.getBlock(8);
        // Extensions - opaque extensions<0..2^16-1>;
        const extenstionLength = stream.getUint16();
        const extensions = stream.getBlock(extenstionLength);
        // Hash algo - enum { sha256(4), . . . (255) }
        const hashAlgorithm = stream.getUint8();
        // Signature algo - enum { anonymous(0), rsa(1), dsa(2), ecdsa(3), (255) }
        const signatureAlgorithm = stream.getUint8();
        // Signature  - opaque signature<0..2^16-1>;
        const sigLength = stream.getUint16();
        const signature = stream.getBlock(sigLength);
        // Check that we read the entire buffer
        if (stream.position !== buf.length) {
            throw new Error('SCT buffer length mismatch');
        }
        return new SignedCertificateTimestamp({
            version,
            logID,
            timestamp,
            extensions,
            hashAlgorithm,
            signatureAlgorithm,
            signature,
        });
    }
}
exports.SignedCertificateTimestamp = SignedCertificateTimestamp;


/***/ }),

/***/ 23688:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HEADER_OCI_SUBJECT = exports.HEADER_LOCATION = exports.HEADER_IF_MATCH = exports.HEADER_ETAG = exports.HEADER_DIGEST = exports.HEADER_CONTENT_TYPE = exports.HEADER_CONTENT_LENGTH = exports.HEADER_AUTHORIZATION = exports.HEADER_AUTHENTICATE = exports.HEADER_API_VERSION = exports.HEADER_ACCEPT = exports.CONTENT_TYPE_EMPTY_DESCRIPTOR = exports.CONTENT_TYPE_OCTET_STREAM = exports.CONTENT_TYPE_DOCKER_MANIFEST_LIST = exports.CONTENT_TYPE_DOCKER_MANIFEST = exports.CONTENT_TYPE_OCI_MANIFEST = exports.CONTENT_TYPE_OCI_INDEX = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
exports.CONTENT_TYPE_OCI_INDEX = 'application/vnd.oci.image.index.v1+json';
exports.CONTENT_TYPE_OCI_MANIFEST = 'application/vnd.oci.image.manifest.v1+json';
exports.CONTENT_TYPE_DOCKER_MANIFEST = 'application/vnd.docker.distribution.manifest.v2+json';
exports.CONTENT_TYPE_DOCKER_MANIFEST_LIST = 'application/vnd.docker.distribution.manifest.list.v2+json';
exports.CONTENT_TYPE_OCTET_STREAM = 'application/octet-stream';
exports.CONTENT_TYPE_EMPTY_DESCRIPTOR = 'application/vnd.oci.empty.v1+json';
exports.HEADER_ACCEPT = 'Accept';
exports.HEADER_API_VERSION = 'Docker-Distribution-API-Version';
exports.HEADER_AUTHENTICATE = 'WWW-Authenticate';
exports.HEADER_AUTHORIZATION = 'Authorization';
exports.HEADER_CONTENT_LENGTH = 'Content-Length';
exports.HEADER_CONTENT_TYPE = 'Content-Type';
exports.HEADER_DIGEST = 'Docker-Content-Digest';
exports.HEADER_ETAG = 'Etag';
exports.HEADER_IF_MATCH = 'If-Match';
exports.HEADER_LOCATION = 'Location';
exports.HEADER_OCI_SUBJECT = 'OCI-Subject';


/***/ }),

/***/ 62691:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fromBasicAuth = exports.toBasicAuth = exports.getRegistryCredentials = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const node_fs_1 = __importDefault(__nccwpck_require__(73024));
const node_os_1 = __importDefault(__nccwpck_require__(48161));
const node_path_1 = __importDefault(__nccwpck_require__(76760));
const name_1 = __nccwpck_require__(96666);
// Returns the credentials for a given registry by reading the Docker config
// file.
const getRegistryCredentials = (imageName) => {
    const { registry } = (0, name_1.parseImageName)(imageName);
    const dockerConfigFile = node_path_1.default.join(node_os_1.default.homedir(), '.docker', 'config.json');
    let content;
    try {
        content = node_fs_1.default.readFileSync(dockerConfigFile, 'utf8');
    }
    catch (err) {
        throw new Error(`No credential file found at ${dockerConfigFile}`);
    }
    const dockerConfig = JSON.parse(content);
    const credKey = Object.keys(dockerConfig.auths || {}).find((key) => key.includes(registry)) || registry;
    const creds = dockerConfig.auths?.[credKey];
    if (!creds) {
        throw new Error(`No credentials found for registry ${registry}`);
    }
    // Extract username/password from auth string
    const { username, password } = (0, exports.fromBasicAuth)(creds.auth);
    // If the identitytoken is present, use it as the password (primarily for ACR)
    const pass = creds.identitytoken ? creds.identitytoken : password;
    return { headers: dockerConfig.HttpHeaders, username, password: pass };
};
exports.getRegistryCredentials = getRegistryCredentials;
// Encode the username and password as base64-encoded basicauth value
const toBasicAuth = (creds) => Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
exports.toBasicAuth = toBasicAuth;
// Decode the base64-encoded basicauth value
const fromBasicAuth = (auth) => {
    // Need to account for the possibility of ':' in the password
    const [username, ...rest] = Buffer.from(auth, 'base64').toString().split(':');
    const password = rest.join(':');
    return { username, password };
};
exports.fromBasicAuth = fromBasicAuth;


/***/ }),

/***/ 46803:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.OCIError = exports.ensureStatus = exports.HTTPError = void 0;
class HTTPError extends Error {
    constructor({ status, message }) {
        super(message);
        this.statusCode = status;
    }
}
exports.HTTPError = HTTPError;
// Inspects the response status and throws an HTTPError if it does not match the
// expected status code
const ensureStatus = (expectedStatus) => {
    return (response) => {
        if (response.status !== expectedStatus) {
            throw new HTTPError({
                message: `Error fetching ${response.url} - expected ${expectedStatus}, received ${response.status}`,
                status: response.status,
            });
        }
        return response;
    };
};
exports.ensureStatus = ensureStatus;
class OCIError extends Error {
    constructor({ message, cause, }) {
        super(message);
        this.cause = cause;
        this.name = this.constructor.name;
    }
}
exports.OCIError = OCIError;


/***/ }),

/***/ 32721:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
/*
Copyright 2024 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const http2_1 = __nccwpck_require__(85675);
const make_fetch_happen_1 = __importDefault(__nccwpck_require__(40614));
const proc_log_1 = __nccwpck_require__(26687);
const promise_retry_1 = __importDefault(__nccwpck_require__(90390));
const { HTTP_STATUS_INTERNAL_SERVER_ERROR, HTTP_STATUS_TOO_MANY_REQUESTS, HTTP_STATUS_REQUEST_TIMEOUT, } = http2_1.constants;
const fetchWithRetry = async (url, options = {}) => {
    return (0, promise_retry_1.default)(async (retry, attemptNum) => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const logRetry = (reason) => {
            proc_log_1.log.http('fetch', `${options.method} ${url} attempt ${attemptNum} failed with ${reason}`);
        };
        const response = await (0, make_fetch_happen_1.default)(url, {
            ...options,
            retry: false, // We're handling retries ourselves
        }).catch((reason) => {
            logRetry(reason);
            return retry(reason);
        });
        if (retryable(response.status)) {
            logRetry(response.status);
            return retry(response);
        }
        return response;
    }, retryOpts(options.retry)).catch((err) => {
        // If we got an actual error, throw it
        if (err instanceof Error) {
            throw err;
        }
        // Otherwise, return the response (this is simply a retry-able response for
        // which we exceeded the retry limit)
        return err;
    });
};
// Returns a wrapped fetch function with default options
fetchWithRetry.defaults = (defaultOptions = {}, wrappedFetch = fetchWithRetry) => {
    const defaultedFetch = (url, options = {}) => {
        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: { ...defaultOptions.headers, ...options.headers },
        };
        return wrappedFetch(url, finalOptions);
    };
    defaultedFetch.defaults = (newDefaults = {}) => fetchWithRetry.defaults(newDefaults, defaultedFetch);
    return defaultedFetch;
};
// Determine if a status code is retryable. This includes 5xx errors, 408, and
// 429.
const retryable = (status) => [HTTP_STATUS_REQUEST_TIMEOUT, HTTP_STATUS_TOO_MANY_REQUESTS].includes(status) || status >= HTTP_STATUS_INTERNAL_SERVER_ERROR;
// Normalize the retry options to the format expected by promise-retry
const retryOpts = (retry) => {
    if (typeof retry === 'boolean') {
        return { retries: retry ? 1 : 0 };
    }
    else if (typeof retry === 'number') {
        return { retries: retry };
    }
    else {
        return { retries: 0, ...retry };
    }
};
exports["default"] = fetchWithRetry;


/***/ }),

/***/ 19812:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _OCIImage_instances, _OCIImage_client, _OCIImage_credentials, _OCIImage_createReferrersIndexByTag;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.OCIImage = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const constants_1 = __nccwpck_require__(23688);
const error_1 = __nccwpck_require__(46803);
const registry_1 = __nccwpck_require__(22138);
const DOCKER_DEFAULT_REGISTRY = 'registry-1.docker.io';
const EMPTY_BLOB = Buffer.from('{}');
class OCIImage {
    constructor(image, creds, opts) {
        _OCIImage_instances.add(this);
        _OCIImage_client.set(this, void 0);
        _OCIImage_credentials.set(this, void 0);
        __classPrivateFieldSet(this, _OCIImage_client, new registry_1.RegistryClient(canonicalizeRegistryName(image.registry), image.path, opts), "f");
        __classPrivateFieldSet(this, _OCIImage_credentials, creds, "f");
    }
    async addArtifact(opts) {
        let artifactDescriptor;
        const annotations = {
            'org.opencontainers.image.created': new Date().toISOString(),
            ...opts.annotations,
        };
        try {
            /* istanbul ignore else */
            if (__classPrivateFieldGet(this, _OCIImage_credentials, "f")) {
                await __classPrivateFieldGet(this, _OCIImage_client, "f").signIn(__classPrivateFieldGet(this, _OCIImage_credentials, "f"));
            }
            // Check that the image exists
            const imageDescriptor = await __classPrivateFieldGet(this, _OCIImage_client, "f").checkManifest(opts.imageDigest);
            // Upload the artifact blob
            const artifactBlob = await __classPrivateFieldGet(this, _OCIImage_client, "f").uploadBlob(opts.artifact);
            // Upload the empty blob (needed for the manifest config)
            const emptyBlob = await __classPrivateFieldGet(this, _OCIImage_client, "f").uploadBlob(EMPTY_BLOB);
            // Construct artifact manifest
            const manifest = buildManifest({
                artifactDescriptor: { ...artifactBlob, mediaType: opts.mediaType },
                subjectDescriptor: imageDescriptor,
                configDescriptor: {
                    ...emptyBlob,
                    mediaType: constants_1.CONTENT_TYPE_EMPTY_DESCRIPTOR,
                },
                annotations,
            });
            // Upload artifact manifest
            artifactDescriptor = await __classPrivateFieldGet(this, _OCIImage_client, "f").uploadManifest(JSON.stringify(manifest));
            // Check to see if registry supports the referrers API. For most
            // registries the presence of a subjectDigest response header when
            // uploading the artifact manifest indicates that the referrers API IS
            // supported -- however, this is not a guarantee (AWS ECR does NOT support
            // the referrers API but still reports a subjectDigest).
            const referrersSupported = await __classPrivateFieldGet(this, _OCIImage_client, "f").pingReferrers();
            // Manually update the referrers list if the referrers API is not supported.
            if (!artifactDescriptor.subjectDigest || !referrersSupported) {
                // Strip subjectDigest from the artifact descriptor (in case it was returned)
                /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
                const { subjectDigest, ...descriptor } = artifactDescriptor;
                await __classPrivateFieldGet(this, _OCIImage_instances, "m", _OCIImage_createReferrersIndexByTag).call(this, {
                    artifact: {
                        ...descriptor,
                        artifactType: opts.mediaType,
                        annotations,
                    },
                    imageDigest: opts.imageDigest,
                });
            }
        }
        catch (err) {
            throw new error_1.OCIError({
                message: `Error uploading artifact to container registry`,
                cause: err,
            });
        }
        return artifactDescriptor;
    }
    async getDigest(tag) {
        try {
            /* istanbul ignore else */
            if (__classPrivateFieldGet(this, _OCIImage_credentials, "f")) {
                await __classPrivateFieldGet(this, _OCIImage_client, "f").signIn(__classPrivateFieldGet(this, _OCIImage_credentials, "f"));
            }
            const imageDescriptor = await __classPrivateFieldGet(this, _OCIImage_client, "f").checkManifest(tag);
            return imageDescriptor.digest;
        }
        catch (err) {
            throw new error_1.OCIError({
                message: `Error retrieving image digest from container registry`,
                cause: err,
            });
        }
    }
}
exports.OCIImage = OCIImage;
_OCIImage_client = new WeakMap(), _OCIImage_credentials = new WeakMap(), _OCIImage_instances = new WeakSet(), _OCIImage_createReferrersIndexByTag = 
// Create a referrers index by tag. This is a fallback for registries that do
// not support the referrers API.
// https://github.com/opencontainers/distribution-spec/blob/main/spec.md#pushing-manifests-with-subject
async function _OCIImage_createReferrersIndexByTag(opts) {
    const referrerTag = digestToTag(opts.imageDigest);
    let referrerManifest;
    let etag;
    try {
        // Retrieve any existing referrer index
        const referrerIndex = await __classPrivateFieldGet(this, _OCIImage_client, "f").getManifest(referrerTag);
        if (referrerIndex.mediaType !== constants_1.CONTENT_TYPE_OCI_INDEX) {
            throw new Error(`Expected referrer manifest type ${constants_1.CONTENT_TYPE_OCI_INDEX}, got ${referrerIndex.mediaType}`);
        }
        referrerManifest = referrerIndex.body;
        etag = referrerIndex.etag;
    }
    catch (err) {
        // If the referrer index does not exist, create a new one
        if (err instanceof error_1.HTTPError && err.statusCode === 404) {
            referrerManifest = newIndex();
        }
        else {
            throw err;
        }
    }
    // If the artifact is not already in the index, add it to the list and
    // re-upload the index
    /* istanbul ignore else */
    if (!referrerManifest.manifests.some((manifest) => manifest.digest === opts.artifact.digest)) {
        // Add the artifact to the index
        referrerManifest.manifests.push(opts.artifact);
        await __classPrivateFieldGet(this, _OCIImage_client, "f").uploadManifest(JSON.stringify(referrerManifest), {
            mediaType: constants_1.CONTENT_TYPE_OCI_INDEX,
            reference: referrerTag,
            etag,
        });
    }
};
// Build an OCI manifest document with references to the given artifact,
// subject, and config
const buildManifest = (opts) => ({
    schemaVersion: 2,
    mediaType: constants_1.CONTENT_TYPE_OCI_MANIFEST,
    artifactType: opts.artifactDescriptor.mediaType,
    config: opts.configDescriptor,
    layers: [opts.artifactDescriptor],
    subject: opts.subjectDescriptor,
    annotations: opts.annotations,
});
// Return an empty OCI index document
const newIndex = () => ({
    mediaType: constants_1.CONTENT_TYPE_OCI_INDEX,
    schemaVersion: 2,
    manifests: [],
});
// Convert an image digest to a tag per the Referrers Tag Schema
// https://github.com/opencontainers/distribution-spec/blob/main/spec.md#referrers-tag-schema
const digestToTag = (digest) => {
    return digest.replace(':', '-');
};
// Canonicalize the registry name to match the format used by the registry
// client. This is used primarily to handle the special case of the Docker Hub
// registry.
// https://github.com/moby/moby/blob/v24.0.2/registry/config.go#L25-L48
const canonicalizeRegistryName = (registry) => {
    return registry.endsWith('docker.io') ? DOCKER_DEFAULT_REGISTRY : registry;
};


/***/ }),

/***/ 81057:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getImageDigest = exports.attachArtifactToImage = exports.OCIError = exports.getRegistryCredentials = void 0;
const image_1 = __nccwpck_require__(19812);
const name_1 = __nccwpck_require__(96666);
var credentials_1 = __nccwpck_require__(62691);
Object.defineProperty(exports, "getRegistryCredentials", ({ enumerable: true, get: function () { return credentials_1.getRegistryCredentials; } }));
var error_1 = __nccwpck_require__(46803);
Object.defineProperty(exports, "OCIError", ({ enumerable: true, get: function () { return error_1.OCIError; } }));
// Associates the given artifact with an OCI image. The artifact is identified
// by its media type and a buffer containing the artifact. The image is
// identified by its FQDN and digest.
const attachArtifactToImage = async (opts) => {
    const image = (0, name_1.parseImageName)(opts.imageName);
    return new image_1.OCIImage(image, opts.credentials, opts.fetchOpts).addArtifact(opts);
};
exports.attachArtifactToImage = attachArtifactToImage;
// Returns the digest of the given image tag in the remote registry.
const getImageDigest = async (opts) => {
    const image = (0, name_1.parseImageName)(opts.imageName);
    return new image_1.OCIImage(image, opts.credentials, opts.fetchOpts).getDigest(opts.imageTag);
};
exports.getImageDigest = getImageDigest;


/***/ }),

/***/ 96666:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.parseImageName = void 0;
const expression = (...res) => res.join('');
const group = (...res) => `(?:${expression(...res)})`;
const repeated = (...res) => `${group(expression(...res))}+`;
const optional = (...res) => `${group(expression(...res))}?`;
const capture = (...res) => `(${expression(...res)})`;
const anchored = (...res) => `^${expression(...res)}$`;
// Lower case letters, numbers
const ALPHA_NUMERIC_RE = '[a-z0-9]+';
// Separators allowed to be embedded in name components. This allows one period,
// one or two underscore or multiple dashes.
const SEPARATOR_RE = group('\\.|_|__|-+');
// Registry path component names to start with at least one letter or number,
// with following parts able to be separated by one period, one or two
// underscores or multiple dashes.
const NAME_COMPONENT_RE = expression(ALPHA_NUMERIC_RE, optional(repeated(SEPARATOR_RE, ALPHA_NUMERIC_RE)));
const NAME_RE = expression(NAME_COMPONENT_RE, repeated(optional('\\/', NAME_COMPONENT_RE)));
// Component of the registry domain must be at least one letter or number, with
// following parts able to be separated by a dash.
const DOMAIN_COMPONENT_RE = group('[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]');
// Restricts the registry domain to be one or more period separated components
// followed by an optional port.
const DOMAIN_RE = expression(DOMAIN_COMPONENT_RE, optional(repeated('\\.', DOMAIN_COMPONENT_RE)), optional(':[0-9]+'));
// Capture the registry domain and path components of a repository name.
const ANCHORED_NAME_RE = anchored(capture(DOMAIN_RE), '\\/', capture(NAME_RE));
// Parses a fully qualified image name into its registry and path components.
const parseImageName = (image) => {
    const matches = image.match(ANCHORED_NAME_RE);
    if (!matches) {
        throw new Error(`Invalid image name: ${image}`);
    }
    return {
        registry: matches[1],
        path: matches[2],
    };
};
exports.parseImageName = parseImageName;


/***/ }),

/***/ 22138:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _RegistryClient_instances, _RegistryClient_baseURL, _RegistryClient_repository, _RegistryClient_fetch, _RegistryClient_fetchDistributionToken, _RegistryClient_fetchOAuth2Token;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RegistryClient = exports.ZERO_DIGEST = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const node_crypto_1 = __importDefault(__nccwpck_require__(77598));
const constants_1 = __nccwpck_require__(23688);
const credentials_1 = __nccwpck_require__(62691);
const error_1 = __nccwpck_require__(46803);
const fetch_1 = __importDefault(__nccwpck_require__(32721));
const ALL_MANIFEST_MEDIA_TYPES = [
    constants_1.CONTENT_TYPE_OCI_INDEX,
    constants_1.CONTENT_TYPE_OCI_MANIFEST,
    constants_1.CONTENT_TYPE_DOCKER_MANIFEST,
    constants_1.CONTENT_TYPE_DOCKER_MANIFEST_LIST,
].join(',');
exports.ZERO_DIGEST = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
class RegistryClient {
    constructor(registry, repository, opts) {
        _RegistryClient_instances.add(this);
        _RegistryClient_baseURL.set(this, void 0);
        _RegistryClient_repository.set(this, void 0);
        _RegistryClient_fetch.set(this, void 0);
        __classPrivateFieldSet(this, _RegistryClient_repository, repository, "f");
        __classPrivateFieldSet(this, _RegistryClient_fetch, fetch_1.default.defaults(opts), "f");
        // Use http for localhost registries, https otherwise
        const hostname = new URL(`http://${registry}`).hostname;
        /* istanbul ignore next */
        const protocol = hostname === 'localhost' || hostname === '127.0.0.1' ? 'http' : 'https';
        __classPrivateFieldSet(this, _RegistryClient_baseURL, `${protocol}://${registry}`, "f");
    }
    // Authenticate with the registry. Sends an unauthenticated request to the
    // registry in order to get an auth challenge. If the challenge scheme is
    // "basic" we don't need a token and can authenticate requests using basic
    // auth. Otherwise, we fetch a token from the auth server and use that to
    // authenticate requests.
    // https://github.com/google/go-containerregistry/blob/main/pkg/authn/README.md#the-registry
    async signIn(creds) {
        // Ensure we include an auth headers if they are present
        __classPrivateFieldSet(this, _RegistryClient_fetch, __classPrivateFieldGet(this, _RegistryClient_fetch, "f").defaults({ headers: creds.headers }), "f");
        // Initiate a blob upload to get the auth challenge
        const probeResponse = await __classPrivateFieldGet(this, _RegistryClient_fetch, "f").call(this, `${__classPrivateFieldGet(this, _RegistryClient_baseURL, "f")}/v2/${__classPrivateFieldGet(this, _RegistryClient_repository, "f")}/blobs/uploads/`, { method: 'POST' });
        // If we get a 200 response, we're already authenticated
        if (probeResponse.status === 200) {
            return;
        }
        const authHeader = probeResponse.headers.get(constants_1.HEADER_AUTHENTICATE) ||
            /* istanbul ignore next */ '';
        const challenge = parseChallenge(authHeader);
        // If the challenge scheme is "basic" we don't need a token and can
        // authenticate requests using basic auth
        if (challenge.scheme === 'basic') {
            const basicAuth = (0, credentials_1.toBasicAuth)(creds);
            __classPrivateFieldSet(this, _RegistryClient_fetch, __classPrivateFieldGet(this, _RegistryClient_fetch, "f").defaults({
                headers: { [constants_1.HEADER_AUTHORIZATION]: `Basic ${basicAuth}` },
            }), "f");
            return;
        }
        let token;
        if (creds.username === '<token>') {
            // If the OAUth2 token request fails, try to fetch a distribution token
            token = await __classPrivateFieldGet(this, _RegistryClient_instances, "m", _RegistryClient_fetchOAuth2Token).call(this, creds, challenge).catch(() => undefined);
        }
        if (!token) {
            token = await __classPrivateFieldGet(this, _RegistryClient_instances, "m", _RegistryClient_fetchDistributionToken).call(this, creds, challenge);
        }
        // Ensure the token is sent with all future requests
        __classPrivateFieldSet(this, _RegistryClient_fetch, __classPrivateFieldGet(this, _RegistryClient_fetch, "f").defaults({
            headers: { [constants_1.HEADER_AUTHORIZATION]: `Bearer ${token}` },
        }), "f");
    }
    // Check the registry API version
    async checkVersion() {
        const response = await __classPrivateFieldGet(this, _RegistryClient_fetch, "f").call(this, `${__classPrivateFieldGet(this, _RegistryClient_baseURL, "f")}/v2/`);
        return response.headers.get(constants_1.HEADER_API_VERSION) || '';
    }
    // Upload a blob to the registry using the post/put method. Calculates the
    // digest of the blob and checks to make sure the blob doesn't already exist
    // in the registry before uploading.
    async uploadBlob(blob) {
        const digest = RegistryClient.digest(blob);
        const size = blob.length;
        // Check if blob already exists
        const headResponse = await __classPrivateFieldGet(this, _RegistryClient_fetch, "f").call(this, `${__classPrivateFieldGet(this, _RegistryClient_baseURL, "f")}/v2/${__classPrivateFieldGet(this, _RegistryClient_repository, "f")}/blobs/${digest}`, { method: 'HEAD', redirect: 'follow' });
        if (headResponse.status === 200) {
            return {
                mediaType: constants_1.CONTENT_TYPE_OCTET_STREAM,
                digest,
                size,
            };
        }
        // Retrieve upload location (session ID)
        const postResponse = await __classPrivateFieldGet(this, _RegistryClient_fetch, "f").call(this, `${__classPrivateFieldGet(this, _RegistryClient_baseURL, "f")}/v2/${__classPrivateFieldGet(this, _RegistryClient_repository, "f")}/blobs/uploads/`, { method: 'POST' }).then((0, error_1.ensureStatus)(202));
        const location = postResponse.headers.get(constants_1.HEADER_LOCATION);
        if (!location) {
            throw new Error('Missing location for blob upload');
        }
        // Translate location to a full URL
        const uploadLocation = new URL(location.startsWith('/') ? `${__classPrivateFieldGet(this, _RegistryClient_baseURL, "f")}${location}` : location);
        // Add digest to query string
        uploadLocation.searchParams.set('digest', digest);
        // Upload blob
        await __classPrivateFieldGet(this, _RegistryClient_fetch, "f").call(this, uploadLocation.href, {
            method: 'PUT',
            body: blob,
            headers: { [constants_1.HEADER_CONTENT_TYPE]: constants_1.CONTENT_TYPE_OCTET_STREAM },
        }).then((0, error_1.ensureStatus)(201));
        return { mediaType: constants_1.CONTENT_TYPE_OCTET_STREAM, digest, size };
    }
    // Checks for the existence of a manifest by reference
    async checkManifest(reference) {
        const response = await __classPrivateFieldGet(this, _RegistryClient_fetch, "f").call(this, `${__classPrivateFieldGet(this, _RegistryClient_baseURL, "f")}/v2/${__classPrivateFieldGet(this, _RegistryClient_repository, "f")}/manifests/${reference}`, {
            method: 'HEAD',
            headers: { [constants_1.HEADER_ACCEPT]: ALL_MANIFEST_MEDIA_TYPES },
        }).then((0, error_1.ensureStatus)(200));
        const mediaType = response.headers.get(constants_1.HEADER_CONTENT_TYPE) ||
            /* istanbul ignore next */ '';
        const digest = response.headers.get(constants_1.HEADER_DIGEST) || /* istanbul ignore next */ '';
        const size = Number(response.headers.get(constants_1.HEADER_CONTENT_LENGTH)) ||
            /* istanbul ignore next */ 0;
        return { mediaType, digest, size };
    }
    // Retrieves a manifest by reference
    async getManifest(reference) {
        const response = await __classPrivateFieldGet(this, _RegistryClient_fetch, "f").call(this, `${__classPrivateFieldGet(this, _RegistryClient_baseURL, "f")}/v2/${__classPrivateFieldGet(this, _RegistryClient_repository, "f")}/manifests/${reference}`, {
            headers: { [constants_1.HEADER_ACCEPT]: ALL_MANIFEST_MEDIA_TYPES },
        }).then((0, error_1.ensureStatus)(200));
        const body = await response.json();
        const mediaType = response.headers.get(constants_1.HEADER_CONTENT_TYPE) ||
            /* istanbul ignore next */ '';
        const digest = response.headers.get(constants_1.HEADER_DIGEST) || /* istanbul ignore next */ '';
        const size = Number(response.headers.get(constants_1.HEADER_CONTENT_LENGTH)) || 0;
        const etag = response.headers.get(constants_1.HEADER_ETAG) || undefined;
        return { body, mediaType, digest, size, etag };
    }
    // Uploads a manifest by digest. If specified, the reference will be used as
    // the manifest tag.
    async uploadManifest(manifest, options = {}) {
        const digest = RegistryClient.digest(manifest);
        const reference = options.reference || digest;
        const contentType = options.mediaType || constants_1.CONTENT_TYPE_OCI_MANIFEST;
        const headers = { [constants_1.HEADER_CONTENT_TYPE]: contentType };
        if (options.etag) {
            headers[constants_1.HEADER_IF_MATCH] = options.etag;
        }
        const response = await __classPrivateFieldGet(this, _RegistryClient_fetch, "f").call(this, `${__classPrivateFieldGet(this, _RegistryClient_baseURL, "f")}/v2/${__classPrivateFieldGet(this, _RegistryClient_repository, "f")}/manifests/${reference}`, { method: 'PUT', body: manifest, headers }).then((0, error_1.ensureStatus)(201));
        const subjectDigest = response.headers.get(constants_1.HEADER_OCI_SUBJECT) || undefined;
        return {
            mediaType: contentType,
            digest,
            size: manifest.length,
            subjectDigest,
        };
    }
    // Returns true if the registry supports the referrers API
    async pingReferrers() {
        const response = await __classPrivateFieldGet(this, _RegistryClient_fetch, "f").call(this, `${__classPrivateFieldGet(this, _RegistryClient_baseURL, "f")}/v2/${__classPrivateFieldGet(this, _RegistryClient_repository, "f")}/referrers/${exports.ZERO_DIGEST}`);
        return response.status === 200;
    }
    static digest(blob) {
        const hash = node_crypto_1.default.createHash('sha256');
        hash.update(blob);
        return `sha256:${hash.digest('hex')}`;
    }
}
exports.RegistryClient = RegistryClient;
_RegistryClient_baseURL = new WeakMap(), _RegistryClient_repository = new WeakMap(), _RegistryClient_fetch = new WeakMap(), _RegistryClient_instances = new WeakSet(), _RegistryClient_fetchDistributionToken = async function _RegistryClient_fetchDistributionToken(creds, challenge) {
    const basicAuth = (0, credentials_1.toBasicAuth)(creds);
    const authURL = new URL(challenge.realm);
    authURL.searchParams.set('service', challenge.service);
    authURL.searchParams.set('scope', challenge.scope);
    // Make token request with basic auth
    const tokenResponse = await __classPrivateFieldGet(this, _RegistryClient_fetch, "f").call(this, authURL.toString(), {
        headers: { [constants_1.HEADER_AUTHORIZATION]: `Basic ${basicAuth}` },
    }).then((0, error_1.ensureStatus)(200));
    return tokenResponse.json().then((json) => json.access_token || json.token);
}, _RegistryClient_fetchOAuth2Token = async function _RegistryClient_fetchOAuth2Token(creds, challenge) {
    const body = new URLSearchParams({
        service: challenge.service,
        scope: challenge.scope,
        username: creds.username,
        password: creds.password,
        grant_type: 'password',
    });
    // Make OAuth token request
    const tokenResponse = await __classPrivateFieldGet(this, _RegistryClient_fetch, "f").call(this, challenge.realm, {
        method: 'POST',
        body,
    }).then((0, error_1.ensureStatus)(200));
    return tokenResponse.json().then((json) => json.access_token);
};
// Parses an auth challenge header into its components
// https://datatracker.ietf.org/doc/html/rfc7235#section-4.1
function parseChallenge(challenge) {
    // Account for the possibility of spaces in the auth params
    const [scheme, ...rest] = challenge.split(' ');
    const authParams = rest.join(' ');
    if (!['Basic', 'Bearer'].includes(scheme)) {
        throw new Error(`Invalid challenge: ${challenge}`);
    }
    return {
        scheme: scheme.toLocaleLowerCase(),
        realm: singleMatch(authParams, /realm="(.+?)"/),
        service: singleMatch(authParams, /service="(.+?)"/),
        scope: singleMatch(authParams, /scope="(.+?)"/),
    };
}
// Returns the first capture group of a regex match, or an empty string
const singleMatch = (str, regex) => str.match(regex)?.[1] || '';


/***/ }),

/***/ 51409:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const contentVer = (__nccwpck_require__(90512)/* ["cache-version"].content */ .MH.Q)
const hashToSegments = __nccwpck_require__(73056)
const path = __nccwpck_require__(16928)
const ssri = __nccwpck_require__(68951)

// Current format of content file path:
//
// sha512-BaSE64Hex= ->
// ~/.my-cache/content-v2/sha512/ba/da/55deadbeefc0ffee
//
module.exports = contentPath

function contentPath (cache, integrity) {
  const sri = ssri.parse(integrity, { single: true })
  // contentPath is the *strongest* algo given
  return path.join(
    contentDir(cache),
    sri.algorithm,
    ...hashToSegments(sri.hexDigest())
  )
}

module.exports.contentDir = contentDir

function contentDir (cache) {
  return path.join(cache, `content-v${contentVer}`)
}


/***/ }),

/***/ 68926:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const fs = __nccwpck_require__(91943)
const fsm = __nccwpck_require__(25032)
const ssri = __nccwpck_require__(68951)
const contentPath = __nccwpck_require__(51409)
const Pipeline = __nccwpck_require__(52899)

module.exports = read

const MAX_SINGLE_READ_SIZE = 64 * 1024 * 1024
async function read (cache, integrity, opts = {}) {
  const { size } = opts
  const { stat, cpath, sri } = await withContentSri(cache, integrity, async (cpath, sri) => {
    // get size
    const stat = size ? { size } : await fs.stat(cpath)
    return { stat, cpath, sri }
  })

  if (stat.size > MAX_SINGLE_READ_SIZE) {
    return readPipeline(cpath, stat.size, sri, new Pipeline()).concat()
  }

  const data = await fs.readFile(cpath, { encoding: null })

  if (stat.size !== data.length) {
    throw sizeError(stat.size, data.length)
  }

  if (!ssri.checkData(data, sri)) {
    throw integrityError(sri, cpath)
  }

  return data
}

const readPipeline = (cpath, size, sri, stream) => {
  stream.push(
    new fsm.ReadStream(cpath, {
      size,
      readSize: MAX_SINGLE_READ_SIZE,
    }),
    ssri.integrityStream({
      integrity: sri,
      size,
    })
  )
  return stream
}

module.exports.stream = readStream
module.exports.readStream = readStream

function readStream (cache, integrity, opts = {}) {
  const { size } = opts
  const stream = new Pipeline()
  // Set all this up to run on the stream and then just return the stream
  Promise.resolve().then(async () => {
    const { stat, cpath, sri } = await withContentSri(cache, integrity, async (cpath, sri) => {
      // get size
      const stat = size ? { size } : await fs.stat(cpath)
      return { stat, cpath, sri }
    })

    return readPipeline(cpath, stat.size, sri, stream)
  }).catch(err => stream.emit('error', err))

  return stream
}

module.exports.copy = copy

function copy (cache, integrity, dest) {
  return withContentSri(cache, integrity, (cpath) => {
    return fs.copyFile(cpath, dest)
  })
}

module.exports.hasContent = hasContent

async function hasContent (cache, integrity) {
  if (!integrity) {
    return false
  }

  try {
    return await withContentSri(cache, integrity, async (cpath, sri) => {
      const stat = await fs.stat(cpath)
      return { size: stat.size, sri, stat }
    })
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false
    }

    if (err.code === 'EPERM') {
      /* istanbul ignore else */
      if (process.platform !== 'win32') {
        throw err
      } else {
        return false
      }
    }
  }
}

async function withContentSri (cache, integrity, fn) {
  const sri = ssri.parse(integrity)
  // If `integrity` has multiple entries, pick the first digest
  // with available local data.
  const algo = sri.pickAlgorithm()
  const digests = sri[algo]

  if (digests.length <= 1) {
    const cpath = contentPath(cache, digests[0])
    return fn(cpath, digests[0])
  } else {
    // Can't use race here because a generic error can happen before
    // a ENOENT error, and can happen before a valid result
    const results = await Promise.all(digests.map(async (meta) => {
      try {
        return await withContentSri(cache, meta, fn)
      } catch (err) {
        if (err.code === 'ENOENT') {
          return Object.assign(
            new Error('No matching content found for ' + sri.toString()),
            { code: 'ENOENT' }
          )
        }
        return err
      }
    }))
    // Return the first non error if it is found
    const result = results.find((r) => !(r instanceof Error))
    if (result) {
      return result
    }

    // Throw the No matching content found error
    const enoentError = results.find((r) => r.code === 'ENOENT')
    if (enoentError) {
      throw enoentError
    }

    // Throw generic error
    throw results.find((r) => r instanceof Error)
  }
}

function sizeError (expected, found) {
  /* eslint-disable-next-line max-len */
  const err = new Error(`Bad data size: expected inserted data to be ${expected} bytes, but got ${found} instead`)
  err.expected = expected
  err.found = found
  err.code = 'EBADSIZE'
  return err
}

function integrityError (sri, path) {
  const err = new Error(`Integrity verification failed for ${sri} (${path})`)
  err.code = 'EINTEGRITY'
  err.sri = sri
  err.path = path
  return err
}


/***/ }),

/***/ 53479:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const fs = __nccwpck_require__(91943)
const contentPath = __nccwpck_require__(51409)
const { hasContent } = __nccwpck_require__(68926)

module.exports = rm

async function rm (cache, integrity) {
  const content = await hasContent(cache, integrity)
  // ~pretty~ sure we can't end up with a content lacking sri, but be safe
  if (content && content.sri) {
    await fs.rm(contentPath(cache, content.sri), { recursive: true, force: true })
    return true
  } else {
    return false
  }
}


/***/ }),

/***/ 76219:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const events = __nccwpck_require__(24434)

const contentPath = __nccwpck_require__(51409)
const fs = __nccwpck_require__(91943)
const { moveFile } = __nccwpck_require__(88437)
const { Minipass } = __nccwpck_require__(78275)
const Pipeline = __nccwpck_require__(52899)
const Flush = __nccwpck_require__(37633)
const path = __nccwpck_require__(16928)
const ssri = __nccwpck_require__(68951)
const uniqueFilename = __nccwpck_require__(46019)
const fsm = __nccwpck_require__(25032)

module.exports = write

// Cache of move operations in process so we don't duplicate
const moveOperations = new Map()

async function write (cache, data, opts = {}) {
  const { algorithms, size, integrity } = opts

  if (typeof size === 'number' && data.length !== size) {
    throw sizeError(size, data.length)
  }

  const sri = ssri.fromData(data, algorithms ? { algorithms } : {})
  if (integrity && !ssri.checkData(data, integrity, opts)) {
    throw checksumError(integrity, sri)
  }

  for (const algo in sri) {
    const tmp = await makeTmp(cache, opts)
    const hash = sri[algo].toString()
    try {
      await fs.writeFile(tmp.target, data, { flag: 'wx' })
      await moveToDestination(tmp, cache, hash, opts)
    } finally {
      if (!tmp.moved) {
        await fs.rm(tmp.target, { recursive: true, force: true })
      }
    }
  }
  return { integrity: sri, size: data.length }
}

module.exports.stream = writeStream

// writes proxied to the 'inputStream' that is passed to the Promise
// 'end' is deferred until content is handled.
class CacacheWriteStream extends Flush {
  constructor (cache, opts) {
    super()
    this.opts = opts
    this.cache = cache
    this.inputStream = new Minipass()
    this.inputStream.on('error', er => this.emit('error', er))
    this.inputStream.on('drain', () => this.emit('drain'))
    this.handleContentP = null
  }

  write (chunk, encoding, cb) {
    if (!this.handleContentP) {
      this.handleContentP = handleContent(
        this.inputStream,
        this.cache,
        this.opts
      )
      this.handleContentP.catch(error => this.emit('error', error))
    }
    return this.inputStream.write(chunk, encoding, cb)
  }

  flush (cb) {
    this.inputStream.end(() => {
      if (!this.handleContentP) {
        const e = new Error('Cache input stream was empty')
        e.code = 'ENODATA'
        // empty streams are probably emitting end right away.
        // defer this one tick by rejecting a promise on it.
        return Promise.reject(e).catch(cb)
      }
      // eslint-disable-next-line promise/catch-or-return
      this.handleContentP.then(
        (res) => {
          res.integrity && this.emit('integrity', res.integrity)
          // eslint-disable-next-line promise/always-return
          res.size !== null && this.emit('size', res.size)
          cb()
        },
        (er) => cb(er)
      )
    })
  }
}

function writeStream (cache, opts = {}) {
  return new CacacheWriteStream(cache, opts)
}

async function handleContent (inputStream, cache, opts) {
  const tmp = await makeTmp(cache, opts)
  try {
    const res = await pipeToTmp(inputStream, cache, tmp.target, opts)
    await moveToDestination(
      tmp,
      cache,
      res.integrity,
      opts
    )
    return res
  } finally {
    if (!tmp.moved) {
      await fs.rm(tmp.target, { recursive: true, force: true })
    }
  }
}

async function pipeToTmp (inputStream, cache, tmpTarget, opts) {
  const outStream = new fsm.WriteStream(tmpTarget, {
    flags: 'wx',
  })

  if (opts.integrityEmitter) {
    // we need to create these all simultaneously since they can fire in any order
    const [integrity, size] = await Promise.all([
      events.once(opts.integrityEmitter, 'integrity').then(res => res[0]),
      events.once(opts.integrityEmitter, 'size').then(res => res[0]),
      new Pipeline(inputStream, outStream).promise(),
    ])
    return { integrity, size }
  }

  let integrity
  let size
  const hashStream = ssri.integrityStream({
    integrity: opts.integrity,
    algorithms: opts.algorithms,
    size: opts.size,
  })
  hashStream.on('integrity', i => {
    integrity = i
  })
  hashStream.on('size', s => {
    size = s
  })

  const pipeline = new Pipeline(inputStream, hashStream, outStream)
  await pipeline.promise()
  return { integrity, size }
}

async function makeTmp (cache, opts) {
  const tmpTarget = uniqueFilename(path.join(cache, 'tmp'), opts.tmpPrefix)
  await fs.mkdir(path.dirname(tmpTarget), { recursive: true })
  return {
    target: tmpTarget,
    moved: false,
  }
}

async function moveToDestination (tmp, cache, sri) {
  const destination = contentPath(cache, sri)
  const destDir = path.dirname(destination)
  if (moveOperations.has(destination)) {
    return moveOperations.get(destination)
  }
  moveOperations.set(
    destination,
    fs.mkdir(destDir, { recursive: true })
      .then(async () => {
        await moveFile(tmp.target, destination, { overwrite: false })
        tmp.moved = true
        return tmp.moved
      })
      .catch(err => {
        if (!err.message.startsWith('The destination file exists')) {
          throw Object.assign(err, { code: 'EEXIST' })
        }
      }).finally(() => {
        moveOperations.delete(destination)
      })

  )
  return moveOperations.get(destination)
}

function sizeError (expected, found) {
  /* eslint-disable-next-line max-len */
  const err = new Error(`Bad data size: expected inserted data to be ${expected} bytes, but got ${found} instead`)
  err.expected = expected
  err.found = found
  err.code = 'EBADSIZE'
  return err
}

function checksumError (expected, found) {
  const err = new Error(`Integrity check failed:
  Wanted: ${expected}
   Found: ${found}`)
  err.code = 'EINTEGRITY'
  err.expected = expected
  err.found = found
  return err
}


/***/ }),

/***/ 90775:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const crypto = __nccwpck_require__(76982)
const {
  appendFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} = __nccwpck_require__(91943)
const { Minipass } = __nccwpck_require__(78275)
const path = __nccwpck_require__(16928)
const ssri = __nccwpck_require__(68951)
const uniqueFilename = __nccwpck_require__(46019)

const contentPath = __nccwpck_require__(51409)
const hashToSegments = __nccwpck_require__(73056)
const indexV = (__nccwpck_require__(90512)/* ["cache-version"].index */ .MH.P)
const { moveFile } = __nccwpck_require__(88437)

const lsStreamConcurrency = 5

module.exports.NotFoundError = class NotFoundError extends Error {
  constructor (cache, key) {
    super(`No cache entry for ${key} found in ${cache}`)
    this.code = 'ENOENT'
    this.cache = cache
    this.key = key
  }
}

module.exports.compact = compact

async function compact (cache, key, matchFn, opts = {}) {
  const bucket = bucketPath(cache, key)
  const entries = await bucketEntries(bucket)
  const newEntries = []
  // we loop backwards because the bottom-most result is the newest
  // since we add new entries with appendFile
  for (let i = entries.length - 1; i >= 0; --i) {
    const entry = entries[i]
    // a null integrity could mean either a delete was appended
    // or the user has simply stored an index that does not map
    // to any content. we determine if the user wants to keep the
    // null integrity based on the validateEntry function passed in options.
    // if the integrity is null and no validateEntry is provided, we break
    // as we consider the null integrity to be a deletion of everything
    // that came before it.
    if (entry.integrity === null && !opts.validateEntry) {
      break
    }

    // if this entry is valid, and it is either the first entry or
    // the newEntries array doesn't already include an entry that
    // matches this one based on the provided matchFn, then we add
    // it to the beginning of our list
    if ((!opts.validateEntry || opts.validateEntry(entry) === true) &&
      (newEntries.length === 0 ||
        !newEntries.find((oldEntry) => matchFn(oldEntry, entry)))) {
      newEntries.unshift(entry)
    }
  }

  const newIndex = '\n' + newEntries.map((entry) => {
    const stringified = JSON.stringify(entry)
    const hash = hashEntry(stringified)
    return `${hash}\t${stringified}`
  }).join('\n')

  const setup = async () => {
    const target = uniqueFilename(path.join(cache, 'tmp'), opts.tmpPrefix)
    await mkdir(path.dirname(target), { recursive: true })
    return {
      target,
      moved: false,
    }
  }

  const teardown = async (tmp) => {
    if (!tmp.moved) {
      return rm(tmp.target, { recursive: true, force: true })
    }
  }

  const write = async (tmp) => {
    await writeFile(tmp.target, newIndex, { flag: 'wx' })
    await mkdir(path.dirname(bucket), { recursive: true })
    // we use @npmcli/move-file directly here because we
    // want to overwrite the existing file
    await moveFile(tmp.target, bucket)
    tmp.moved = true
  }

  // write the file atomically
  const tmp = await setup()
  try {
    await write(tmp)
  } finally {
    await teardown(tmp)
  }

  // we reverse the list we generated such that the newest
  // entries come first in order to make looping through them easier
  // the true passed to formatEntry tells it to keep null
  // integrity values, if they made it this far it's because
  // validateEntry returned true, and as such we should return it
  return newEntries.reverse().map((entry) => formatEntry(cache, entry, true))
}

module.exports.insert = insert

async function insert (cache, key, integrity, opts = {}) {
  const { metadata, size, time } = opts
  const bucket = bucketPath(cache, key)
  const entry = {
    key,
    integrity: integrity && ssri.stringify(integrity),
    time: time || Date.now(),
    size,
    metadata,
  }
  try {
    await mkdir(path.dirname(bucket), { recursive: true })
    const stringified = JSON.stringify(entry)
    // NOTE - Cleverness ahoy!
    //
    // This works because it's tremendously unlikely for an entry to corrupt
    // another while still preserving the string length of the JSON in
    // question. So, we just slap the length in there and verify it on read.
    //
    // Thanks to @isaacs for the whiteboarding session that ended up with
    // this.
    await appendFile(bucket, `\n${hashEntry(stringified)}\t${stringified}`)
  } catch (err) {
    if (err.code === 'ENOENT') {
      return undefined
    }

    throw err
  }
  return formatEntry(cache, entry)
}

module.exports.find = find

async function find (cache, key) {
  const bucket = bucketPath(cache, key)
  try {
    const entries = await bucketEntries(bucket)
    return entries.reduce((latest, next) => {
      if (next && next.key === key) {
        return formatEntry(cache, next)
      } else {
        return latest
      }
    }, null)
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null
    } else {
      throw err
    }
  }
}

module.exports["delete"] = del

function del (cache, key, opts = {}) {
  if (!opts.removeFully) {
    return insert(cache, key, null, opts)
  }

  const bucket = bucketPath(cache, key)
  return rm(bucket, { recursive: true, force: true })
}

module.exports.lsStream = lsStream

function lsStream (cache) {
  const indexDir = bucketDir(cache)
  const stream = new Minipass({ objectMode: true })

  // Set all this up to run on the stream and then just return the stream
  Promise.resolve().then(async () => {
    const { default: pMap } = await __nccwpck_require__.e(/* import() */ 606).then(__nccwpck_require__.bind(__nccwpck_require__, 606))
    const buckets = await readdirOrEmpty(indexDir)
    await pMap(buckets, async (bucket) => {
      const bucketPath = path.join(indexDir, bucket)
      const subbuckets = await readdirOrEmpty(bucketPath)
      await pMap(subbuckets, async (subbucket) => {
        const subbucketPath = path.join(bucketPath, subbucket)

        // "/cachename/<bucket 0xFF>/<bucket 0xFF>./*"
        const subbucketEntries = await readdirOrEmpty(subbucketPath)
        await pMap(subbucketEntries, async (entry) => {
          const entryPath = path.join(subbucketPath, entry)
          try {
            const entries = await bucketEntries(entryPath)
            // using a Map here prevents duplicate keys from showing up
            // twice, I guess?
            const reduced = entries.reduce((acc, entry) => {
              acc.set(entry.key, entry)
              return acc
            }, new Map())
            // reduced is a map of key => entry
            for (const entry of reduced.values()) {
              const formatted = formatEntry(cache, entry)
              if (formatted) {
                stream.write(formatted)
              }
            }
          } catch (err) {
            if (err.code === 'ENOENT') {
              return undefined
            }
            throw err
          }
        },
        { concurrency: lsStreamConcurrency })
      },
      { concurrency: lsStreamConcurrency })
    },
    { concurrency: lsStreamConcurrency })
    stream.end()
    return stream
  }).catch(err => stream.emit('error', err))

  return stream
}

module.exports.ls = ls

async function ls (cache) {
  const entries = await lsStream(cache).collect()
  return entries.reduce((acc, xs) => {
    acc[xs.key] = xs
    return acc
  }, {})
}

module.exports.bucketEntries = bucketEntries

async function bucketEntries (bucket, filter) {
  const data = await readFile(bucket, 'utf8')
  return _bucketEntries(data, filter)
}

function _bucketEntries (data) {
  const entries = []
  data.split('\n').forEach((entry) => {
    if (!entry) {
      return
    }

    const pieces = entry.split('\t')
    if (!pieces[1] || hashEntry(pieces[1]) !== pieces[0]) {
      // Hash is no good! Corruption or malice? Doesn't matter!
      // EJECT EJECT
      return
    }
    let obj
    try {
      obj = JSON.parse(pieces[1])
    } catch (_) {
      // eslint-ignore-next-line no-empty-block
    }
    // coverage disabled here, no need to test with an entry that parses to something falsey
    // istanbul ignore else
    if (obj) {
      entries.push(obj)
    }
  })
  return entries
}

module.exports.bucketDir = bucketDir

function bucketDir (cache) {
  return path.join(cache, `index-v${indexV}`)
}

module.exports.bucketPath = bucketPath

function bucketPath (cache, key) {
  const hashed = hashKey(key)
  return path.join.apply(
    path,
    [bucketDir(cache)].concat(hashToSegments(hashed))
  )
}

module.exports.hashKey = hashKey

function hashKey (key) {
  return hash(key, 'sha256')
}

module.exports.hashEntry = hashEntry

function hashEntry (str) {
  return hash(str, 'sha1')
}

function hash (str, digest) {
  return crypto
    .createHash(digest)
    .update(str)
    .digest('hex')
}

function formatEntry (cache, entry, keepAll) {
  // Treat null digests as deletions. They'll shadow any previous entries.
  if (!entry.integrity && !keepAll) {
    return null
  }

  return {
    key: entry.key,
    integrity: entry.integrity,
    path: entry.integrity ? contentPath(cache, entry.integrity) : undefined,
    size: entry.size,
    time: entry.time,
    metadata: entry.metadata,
  }
}

function readdirOrEmpty (dir) {
  return readdir(dir).catch((err) => {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
      return []
    }

    throw err
  })
}


/***/ }),

/***/ 55058:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const Collect = __nccwpck_require__(11757)
const { Minipass } = __nccwpck_require__(78275)
const Pipeline = __nccwpck_require__(52899)

const index = __nccwpck_require__(90775)
const memo = __nccwpck_require__(90668)
const read = __nccwpck_require__(68926)

async function getData (cache, key, opts = {}) {
  const { integrity, memoize, size } = opts
  const memoized = memo.get(cache, key, opts)
  if (memoized && memoize !== false) {
    return {
      metadata: memoized.entry.metadata,
      data: memoized.data,
      integrity: memoized.entry.integrity,
      size: memoized.entry.size,
    }
  }

  const entry = await index.find(cache, key, opts)
  if (!entry) {
    throw new index.NotFoundError(cache, key)
  }
  const data = await read(cache, entry.integrity, { integrity, size })
  if (memoize) {
    memo.put(cache, entry, data, opts)
  }

  return {
    data,
    metadata: entry.metadata,
    size: entry.size,
    integrity: entry.integrity,
  }
}
module.exports = getData

async function getDataByDigest (cache, key, opts = {}) {
  const { integrity, memoize, size } = opts
  const memoized = memo.get.byDigest(cache, key, opts)
  if (memoized && memoize !== false) {
    return memoized
  }

  const res = await read(cache, key, { integrity, size })
  if (memoize) {
    memo.put.byDigest(cache, key, res, opts)
  }
  return res
}
module.exports.byDigest = getDataByDigest

const getMemoizedStream = (memoized) => {
  const stream = new Minipass()
  stream.on('newListener', function (ev, cb) {
    ev === 'metadata' && cb(memoized.entry.metadata)
    ev === 'integrity' && cb(memoized.entry.integrity)
    ev === 'size' && cb(memoized.entry.size)
  })
  stream.end(memoized.data)
  return stream
}

function getStream (cache, key, opts = {}) {
  const { memoize, size } = opts
  const memoized = memo.get(cache, key, opts)
  if (memoized && memoize !== false) {
    return getMemoizedStream(memoized)
  }

  const stream = new Pipeline()
  // Set all this up to run on the stream and then just return the stream
  Promise.resolve().then(async () => {
    const entry = await index.find(cache, key)
    if (!entry) {
      throw new index.NotFoundError(cache, key)
    }

    stream.emit('metadata', entry.metadata)
    stream.emit('integrity', entry.integrity)
    stream.emit('size', entry.size)
    stream.on('newListener', function (ev, cb) {
      ev === 'metadata' && cb(entry.metadata)
      ev === 'integrity' && cb(entry.integrity)
      ev === 'size' && cb(entry.size)
    })

    const src = read.readStream(
      cache,
      entry.integrity,
      { ...opts, size: typeof size !== 'number' ? entry.size : size }
    )

    if (memoize) {
      const memoStream = new Collect.PassThrough()
      memoStream.on('collect', data => memo.put(cache, entry, data, opts))
      stream.unshift(memoStream)
    }
    stream.unshift(src)
    return stream
  }).catch((err) => stream.emit('error', err))

  return stream
}

module.exports.stream = getStream

function getStreamDigest (cache, integrity, opts = {}) {
  const { memoize } = opts
  const memoized = memo.get.byDigest(cache, integrity, opts)
  if (memoized && memoize !== false) {
    const stream = new Minipass()
    stream.end(memoized)
    return stream
  } else {
    const stream = read.readStream(cache, integrity, opts)
    if (!memoize) {
      return stream
    }

    const memoStream = new Collect.PassThrough()
    memoStream.on('collect', data => memo.put.byDigest(
      cache,
      integrity,
      data,
      opts
    ))
    return new Pipeline(stream, memoStream)
  }
}

module.exports.stream.byDigest = getStreamDigest

function info (cache, key, opts = {}) {
  const { memoize } = opts
  const memoized = memo.get(cache, key, opts)
  if (memoized && memoize !== false) {
    return Promise.resolve(memoized.entry)
  } else {
    return index.find(cache, key)
  }
}
module.exports.info = info

async function copy (cache, key, dest, opts = {}) {
  const entry = await index.find(cache, key, opts)
  if (!entry) {
    throw new index.NotFoundError(cache, key)
  }
  await read.copy(cache, entry.integrity, dest, opts)
  return {
    metadata: entry.metadata,
    size: entry.size,
    integrity: entry.integrity,
  }
}

module.exports.copy = copy

async function copyByDigest (cache, key, dest, opts = {}) {
  await read.copy(cache, key, dest, opts)
  return key
}

module.exports.copy.byDigest = copyByDigest

module.exports.hasContent = read.hasContent


/***/ }),

/***/ 44870:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const get = __nccwpck_require__(55058)
const put = __nccwpck_require__(72979)
const rm = __nccwpck_require__(17809)
const verify = __nccwpck_require__(45613)
const { clearMemoized } = __nccwpck_require__(90668)
const tmp = __nccwpck_require__(20942)
const index = __nccwpck_require__(90775)

module.exports.index = {}
module.exports.index.compact = index.compact
module.exports.index.insert = index.insert

module.exports.ls = index.ls
module.exports.ls.stream = index.lsStream

module.exports.get = get
module.exports.get.byDigest = get.byDigest
module.exports.get.stream = get.stream
module.exports.get.stream.byDigest = get.stream.byDigest
module.exports.get.copy = get.copy
module.exports.get.copy.byDigest = get.copy.byDigest
module.exports.get.info = get.info
module.exports.get.hasContent = get.hasContent

module.exports.put = put
module.exports.put.stream = put.stream

module.exports.rm = rm.entry
module.exports.rm.all = rm.all
module.exports.rm.entry = module.exports.rm
module.exports.rm.content = rm.content

module.exports.clearMemoized = clearMemoized

module.exports.tmp = {}
module.exports.tmp.mkdir = tmp.mkdir
module.exports.tmp.withTmp = tmp.withTmp

module.exports.verify = verify
module.exports.verify.lastRun = verify.lastRun


/***/ }),

/***/ 90668:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const { LRUCache } = __nccwpck_require__(78931)

const MEMOIZED = new LRUCache({
  max: 500,
  maxSize: 50 * 1024 * 1024, // 50MB
  ttl: 3 * 60 * 1000, // 3 minutes
  sizeCalculation: (entry, key) => key.startsWith('key:') ? entry.data.length : entry.length,
})

module.exports.clearMemoized = clearMemoized

function clearMemoized () {
  const old = {}
  MEMOIZED.forEach((v, k) => {
    old[k] = v
  })
  MEMOIZED.clear()
  return old
}

module.exports.put = put

function put (cache, entry, data, opts) {
  pickMem(opts).set(`key:${cache}:${entry.key}`, { entry, data })
  putDigest(cache, entry.integrity, data, opts)
}

module.exports.put.byDigest = putDigest

function putDigest (cache, integrity, data, opts) {
  pickMem(opts).set(`digest:${cache}:${integrity}`, data)
}

module.exports.get = get

function get (cache, key, opts) {
  return pickMem(opts).get(`key:${cache}:${key}`)
}

module.exports.get.byDigest = getDigest

function getDigest (cache, integrity, opts) {
  return pickMem(opts).get(`digest:${cache}:${integrity}`)
}

class ObjProxy {
  constructor (obj) {
    this.obj = obj
  }

  get (key) {
    return this.obj[key]
  }

  set (key, val) {
    this.obj[key] = val
  }
}

function pickMem (opts) {
  if (!opts || !opts.memoize) {
    return MEMOIZED
  } else if (opts.memoize.get && opts.memoize.set) {
    return opts.memoize
  } else if (typeof opts.memoize === 'object') {
    return new ObjProxy(opts.memoize)
  } else {
    return MEMOIZED
  }
}


/***/ }),

/***/ 72979:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const index = __nccwpck_require__(90775)
const memo = __nccwpck_require__(90668)
const write = __nccwpck_require__(76219)
const Flush = __nccwpck_require__(37633)
const { PassThrough } = __nccwpck_require__(11757)
const Pipeline = __nccwpck_require__(52899)

const putOpts = (opts) => ({
  algorithms: ['sha512'],
  ...opts,
})

module.exports = putData

async function putData (cache, key, data, opts = {}) {
  const { memoize } = opts
  opts = putOpts(opts)
  const res = await write(cache, data, opts)
  const entry = await index.insert(cache, key, res.integrity, { ...opts, size: res.size })
  if (memoize) {
    memo.put(cache, entry, data, opts)
  }

  return res.integrity
}

module.exports.stream = putStream

function putStream (cache, key, opts = {}) {
  const { memoize } = opts
  opts = putOpts(opts)
  let integrity
  let size
  let error

  let memoData
  const pipeline = new Pipeline()
  // first item in the pipeline is the memoizer, because we need
  // that to end first and get the collected data.
  if (memoize) {
    const memoizer = new PassThrough().on('collect', data => {
      memoData = data
    })
    pipeline.push(memoizer)
  }

  // contentStream is a write-only, not a passthrough
  // no data comes out of it.
  const contentStream = write.stream(cache, opts)
    .on('integrity', (int) => {
      integrity = int
    })
    .on('size', (s) => {
      size = s
    })
    .on('error', (err) => {
      error = err
    })

  pipeline.push(contentStream)

  // last but not least, we write the index and emit hash and size,
  // and memoize if we're doing that
  pipeline.push(new Flush({
    async flush () {
      if (!error) {
        const entry = await index.insert(cache, key, integrity, { ...opts, size })
        if (memoize && memoData) {
          memo.put(cache, entry, memoData, opts)
        }
        pipeline.emit('integrity', integrity)
        pipeline.emit('size', size)
      }
    },
  }))

  return pipeline
}


/***/ }),

/***/ 17809:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const { rm } = __nccwpck_require__(91943)
const glob = __nccwpck_require__(59641)
const index = __nccwpck_require__(90775)
const memo = __nccwpck_require__(90668)
const path = __nccwpck_require__(16928)
const rmContent = __nccwpck_require__(53479)

module.exports = entry
module.exports.entry = entry

function entry (cache, key, opts) {
  memo.clearMemoized()
  return index.delete(cache, key, opts)
}

module.exports.content = content

function content (cache, integrity) {
  memo.clearMemoized()
  return rmContent(cache, integrity)
}

module.exports.all = all

async function all (cache) {
  memo.clearMemoized()
  const paths = await glob(path.join(cache, '*(content-*|index-*)'), { silent: true, nosort: true })
  return Promise.all(paths.map((p) => rm(p, { recursive: true, force: true })))
}


/***/ }),

/***/ 59641:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const { glob } = __nccwpck_require__(44629)
const path = __nccwpck_require__(16928)

const globify = (pattern) => pattern.split(path.win32.sep).join(path.posix.sep)
module.exports = (path, options) => glob(globify(path), options)


/***/ }),

/***/ 73056:
/***/ ((module) => {

"use strict";


module.exports = hashToSegments

function hashToSegments (hash) {
  return [hash.slice(0, 2), hash.slice(2, 4), hash.slice(4)]
}


/***/ }),

/***/ 20942:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const { withTempDir } = __nccwpck_require__(88437)
const fs = __nccwpck_require__(91943)
const path = __nccwpck_require__(16928)

module.exports.mkdir = mktmpdir

async function mktmpdir (cache, opts = {}) {
  const { tmpPrefix } = opts
  const tmpDir = path.join(cache, 'tmp')
  await fs.mkdir(tmpDir, { recursive: true, owner: 'inherit' })
  // do not use path.join(), it drops the trailing / if tmpPrefix is unset
  const target = `${tmpDir}${path.sep}${tmpPrefix || ''}`
  return fs.mkdtemp(target, { owner: 'inherit' })
}

module.exports.withTmp = withTmp

function withTmp (cache, opts, cb) {
  if (!cb) {
    cb = opts
    opts = {}
  }
  return withTempDir(path.join(cache, 'tmp'), cb, opts)
}


/***/ }),

/***/ 45613:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const {
  mkdir,
  readFile,
  rm,
  stat,
  truncate,
  writeFile,
} = __nccwpck_require__(91943)
const contentPath = __nccwpck_require__(51409)
const fsm = __nccwpck_require__(25032)
const glob = __nccwpck_require__(59641)
const index = __nccwpck_require__(90775)
const path = __nccwpck_require__(16928)
const ssri = __nccwpck_require__(68951)

const hasOwnProperty = (obj, key) =>
  Object.prototype.hasOwnProperty.call(obj, key)

const verifyOpts = (opts) => ({
  concurrency: 20,
  log: { silly () {} },
  ...opts,
})

module.exports = verify

async function verify (cache, opts) {
  opts = verifyOpts(opts)
  opts.log.silly('verify', 'verifying cache at', cache)

  const steps = [
    markStartTime,
    fixPerms,
    garbageCollect,
    rebuildIndex,
    cleanTmp,
    writeVerifile,
    markEndTime,
  ]

  const stats = {}
  for (const step of steps) {
    const label = step.name
    const start = new Date()
    const s = await step(cache, opts)
    if (s) {
      Object.keys(s).forEach((k) => {
        stats[k] = s[k]
      })
    }
    const end = new Date()
    if (!stats.runTime) {
      stats.runTime = {}
    }
    stats.runTime[label] = end - start
  }
  stats.runTime.total = stats.endTime - stats.startTime
  opts.log.silly(
    'verify',
    'verification finished for',
    cache,
    'in',
    `${stats.runTime.total}ms`
  )
  return stats
}

async function markStartTime () {
  return { startTime: new Date() }
}

async function markEndTime () {
  return { endTime: new Date() }
}

async function fixPerms (cache, opts) {
  opts.log.silly('verify', 'fixing cache permissions')
  await mkdir(cache, { recursive: true })
  return null
}

// Implements a naive mark-and-sweep tracing garbage collector.
//
// The algorithm is basically as follows:
// 1. Read (and filter) all index entries ("pointers")
// 2. Mark each integrity value as "live"
// 3. Read entire filesystem tree in `content-vX/` dir
// 4. If content is live, verify its checksum and delete it if it fails
// 5. If content is not marked as live, rm it.
//
async function garbageCollect (cache, opts) {
  opts.log.silly('verify', 'garbage collecting content')
  const { default: pMap } = await __nccwpck_require__.e(/* import() */ 606).then(__nccwpck_require__.bind(__nccwpck_require__, 606))
  const indexStream = index.lsStream(cache)
  const liveContent = new Set()
  indexStream.on('data', (entry) => {
    if (opts.filter && !opts.filter(entry)) {
      return
    }

    // integrity is stringified, re-parse it so we can get each hash
    const integrity = ssri.parse(entry.integrity)
    for (const algo in integrity) {
      liveContent.add(integrity[algo].toString())
    }
  })
  await new Promise((resolve, reject) => {
    indexStream.on('end', resolve).on('error', reject)
  })
  const contentDir = contentPath.contentDir(cache)
  const files = await glob(path.join(contentDir, '**'), {
    follow: false,
    nodir: true,
    nosort: true,
  })
  const stats = {
    verifiedContent: 0,
    reclaimedCount: 0,
    reclaimedSize: 0,
    badContentCount: 0,
    keptSize: 0,
  }
  await pMap(
    files,
    async (f) => {
      const split = f.split(/[/\\]/)
      const digest = split.slice(split.length - 3).join('')
      const algo = split[split.length - 4]
      const integrity = ssri.fromHex(digest, algo)
      if (liveContent.has(integrity.toString())) {
        const info = await verifyContent(f, integrity)
        if (!info.valid) {
          stats.reclaimedCount++
          stats.badContentCount++
          stats.reclaimedSize += info.size
        } else {
          stats.verifiedContent++
          stats.keptSize += info.size
        }
      } else {
        // No entries refer to this content. We can delete.
        stats.reclaimedCount++
        const s = await stat(f)
        await rm(f, { recursive: true, force: true })
        stats.reclaimedSize += s.size
      }
      return stats
    },
    { concurrency: opts.concurrency }
  )
  return stats
}

async function verifyContent (filepath, sri) {
  const contentInfo = {}
  try {
    const { size } = await stat(filepath)
    contentInfo.size = size
    contentInfo.valid = true
    await ssri.checkStream(new fsm.ReadStream(filepath), sri)
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { size: 0, valid: false }
    }
    if (err.code !== 'EINTEGRITY') {
      throw err
    }

    await rm(filepath, { recursive: true, force: true })
    contentInfo.valid = false
  }
  return contentInfo
}

async function rebuildIndex (cache, opts) {
  opts.log.silly('verify', 'rebuilding index')
  const { default: pMap } = await __nccwpck_require__.e(/* import() */ 606).then(__nccwpck_require__.bind(__nccwpck_require__, 606))
  const entries = await index.ls(cache)
  const stats = {
    missingContent: 0,
    rejectedEntries: 0,
    totalEntries: 0,
  }
  const buckets = {}
  for (const k in entries) {
    /* istanbul ignore else */
    if (hasOwnProperty(entries, k)) {
      const hashed = index.hashKey(k)
      const entry = entries[k]
      const excluded = opts.filter && !opts.filter(entry)
      excluded && stats.rejectedEntries++
      if (buckets[hashed] && !excluded) {
        buckets[hashed].push(entry)
      } else if (buckets[hashed] && excluded) {
        // skip
      } else if (excluded) {
        buckets[hashed] = []
        buckets[hashed]._path = index.bucketPath(cache, k)
      } else {
        buckets[hashed] = [entry]
        buckets[hashed]._path = index.bucketPath(cache, k)
      }
    }
  }
  await pMap(
    Object.keys(buckets),
    (key) => {
      return rebuildBucket(cache, buckets[key], stats, opts)
    },
    { concurrency: opts.concurrency }
  )
  return stats
}

async function rebuildBucket (cache, bucket, stats) {
  await truncate(bucket._path)
  // This needs to be serialized because cacache explicitly
  // lets very racy bucket conflicts clobber each other.
  for (const entry of bucket) {
    const content = contentPath(cache, entry.integrity)
    try {
      await stat(content)
      await index.insert(cache, entry.key, entry.integrity, {
        metadata: entry.metadata,
        size: entry.size,
        time: entry.time,
      })
      stats.totalEntries++
    } catch (err) {
      if (err.code === 'ENOENT') {
        stats.rejectedEntries++
        stats.missingContent++
      } else {
        throw err
      }
    }
  }
}

function cleanTmp (cache, opts) {
  opts.log.silly('verify', 'cleaning tmp directory')
  return rm(path.join(cache, 'tmp'), { recursive: true, force: true })
}

async function writeVerifile (cache, opts) {
  const verifile = path.join(cache, '_lastverified')
  opts.log.silly('verify', 'writing verifile to ' + verifile)
  return writeFile(verifile, `${Date.now()}`)
}

module.exports.lastRun = lastRun

async function lastRun (cache) {
  const data = await readFile(path.join(cache, '_lastverified'), { encoding: 'utf8' })
  return new Date(+data)
}


/***/ }),

/***/ 46967:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const { Request, Response } = __nccwpck_require__(88483)
const { Minipass } = __nccwpck_require__(78275)
const MinipassFlush = __nccwpck_require__(37633)
const cacache = __nccwpck_require__(44870)
const url = __nccwpck_require__(87016)

const CachingMinipassPipeline = __nccwpck_require__(94210)
const CachePolicy = __nccwpck_require__(61097)
const cacheKey = __nccwpck_require__(14296)
const remote = __nccwpck_require__(20598)

const hasOwnProperty = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop)

// allow list for request headers that will be written to the cache index
// note: we will also store any request headers
// that are named in a response's vary header
const KEEP_REQUEST_HEADERS = [
  'accept-charset',
  'accept-encoding',
  'accept-language',
  'accept',
  'cache-control',
]

// allow list for response headers that will be written to the cache index
// note: we must not store the real response's age header, or when we load
// a cache policy based on the metadata it will think the cached response
// is always stale
const KEEP_RESPONSE_HEADERS = [
  'cache-control',
  'content-encoding',
  'content-language',
  'content-type',
  'date',
  'etag',
  'expires',
  'last-modified',
  'link',
  'location',
  'pragma',
  'vary',
]

// return an object containing all metadata to be written to the index
const getMetadata = (request, response, options) => {
  const metadata = {
    time: Date.now(),
    url: request.url,
    reqHeaders: {},
    resHeaders: {},

    // options on which we must match the request and vary the response
    options: {
      compress: options.compress != null ? options.compress : request.compress,
    },
  }

  // only save the status if it's not a 200 or 304
  if (response.status !== 200 && response.status !== 304) {
    metadata.status = response.status
  }

  for (const name of KEEP_REQUEST_HEADERS) {
    if (request.headers.has(name)) {
      metadata.reqHeaders[name] = request.headers.get(name)
    }
  }

  // if the request's host header differs from the host in the url
  // we need to keep it, otherwise it's just noise and we ignore it
  const host = request.headers.get('host')
  const parsedUrl = new url.URL(request.url)
  if (host && parsedUrl.host !== host) {
    metadata.reqHeaders.host = host
  }

  // if the response has a vary header, make sure
  // we store the relevant request headers too
  if (response.headers.has('vary')) {
    const vary = response.headers.get('vary')
    // a vary of "*" means every header causes a different response.
    // in that scenario, we do not include any additional headers
    // as the freshness check will always fail anyway and we don't
    // want to bloat the cache indexes
    if (vary !== '*') {
      // copy any other request headers that will vary the response
      const varyHeaders = vary.trim().toLowerCase().split(/\s*,\s*/)
      for (const name of varyHeaders) {
        if (request.headers.has(name)) {
          metadata.reqHeaders[name] = request.headers.get(name)
        }
      }
    }
  }

  for (const name of KEEP_RESPONSE_HEADERS) {
    if (response.headers.has(name)) {
      metadata.resHeaders[name] = response.headers.get(name)
    }
  }

  for (const name of options.cacheAdditionalHeaders) {
    if (response.headers.has(name)) {
      metadata.resHeaders[name] = response.headers.get(name)
    }
  }

  return metadata
}

// symbols used to hide objects that may be lazily evaluated in a getter
const _request = Symbol('request')
const _response = Symbol('response')
const _policy = Symbol('policy')

class CacheEntry {
  constructor ({ entry, request, response, options }) {
    if (entry) {
      this.key = entry.key
      this.entry = entry
      // previous versions of this module didn't write an explicit timestamp in
      // the metadata, so fall back to the entry's timestamp. we can't use the
      // entry timestamp to determine staleness because cacache will update it
      // when it verifies its data
      this.entry.metadata.time = this.entry.metadata.time || this.entry.time
    } else {
      this.key = cacheKey(request)
    }

    this.options = options

    // these properties are behind getters that lazily evaluate
    this[_request] = request
    this[_response] = response
    this[_policy] = null
  }

  // returns a CacheEntry instance that satisfies the given request
  // or undefined if no existing entry satisfies
  static async find (request, options) {
    try {
      // compacts the index and returns an array of unique entries
      var matches = await cacache.index.compact(options.cachePath, cacheKey(request), (A, B) => {
        const entryA = new CacheEntry({ entry: A, options })
        const entryB = new CacheEntry({ entry: B, options })
        return entryA.policy.satisfies(entryB.request)
      }, {
        validateEntry: (entry) => {
          // clean out entries with a buggy content-encoding value
          if (entry.metadata &&
              entry.metadata.resHeaders &&
              entry.metadata.resHeaders['content-encoding'] === null) {
            return false
          }

          // if an integrity is null, it needs to have a status specified
          if (entry.integrity === null) {
            return !!(entry.metadata && entry.metadata.status)
          }

          return true
        },
      })
    } catch (err) {
      // if the compact request fails, ignore the error and return
      return
    }

    // a cache mode of 'reload' means to behave as though we have no cache
    // on the way to the network. return undefined to allow cacheFetch to
    // create a brand new request no matter what.
    if (options.cache === 'reload') {
      return
    }

    // find the specific entry that satisfies the request
    let match
    for (const entry of matches) {
      const _entry = new CacheEntry({
        entry,
        options,
      })

      if (_entry.policy.satisfies(request)) {
        match = _entry
        break
      }
    }

    return match
  }

  // if the user made a PUT/POST/PATCH then we invalidate our
  // cache for the same url by deleting the index entirely
  static async invalidate (request, options) {
    const key = cacheKey(request)
    try {
      await cacache.rm.entry(options.cachePath, key, { removeFully: true })
    } catch (err) {
      // ignore errors
    }
  }

  get request () {
    if (!this[_request]) {
      this[_request] = new Request(this.entry.metadata.url, {
        method: 'GET',
        headers: this.entry.metadata.reqHeaders,
        ...this.entry.metadata.options,
      })
    }

    return this[_request]
  }

  get response () {
    if (!this[_response]) {
      this[_response] = new Response(null, {
        url: this.entry.metadata.url,
        counter: this.options.counter,
        status: this.entry.metadata.status || 200,
        headers: {
          ...this.entry.metadata.resHeaders,
          'content-length': this.entry.size,
        },
      })
    }

    return this[_response]
  }

  get policy () {
    if (!this[_policy]) {
      this[_policy] = new CachePolicy({
        entry: this.entry,
        request: this.request,
        response: this.response,
        options: this.options,
      })
    }

    return this[_policy]
  }

  // wraps the response in a pipeline that stores the data
  // in the cache while the user consumes it
  async store (status) {
    // if we got a status other than 200, 301, or 308,
    // or the CachePolicy forbid storage, append the
    // cache status header and return it untouched
    if (
      this.request.method !== 'GET' ||
      ![200, 301, 308].includes(this.response.status) ||
      !this.policy.storable()
    ) {
      this.response.headers.set('x-local-cache-status', 'skip')
      return this.response
    }

    const size = this.response.headers.get('content-length')
    const cacheOpts = {
      algorithms: this.options.algorithms,
      metadata: getMetadata(this.request, this.response, this.options),
      size,
      integrity: this.options.integrity,
      integrityEmitter: this.response.body.hasIntegrityEmitter && this.response.body,
    }

    let body = null
    // we only set a body if the status is a 200, redirects are
    // stored as metadata only
    if (this.response.status === 200) {
      let cacheWriteResolve, cacheWriteReject
      const cacheWritePromise = new Promise((resolve, reject) => {
        cacheWriteResolve = resolve
        cacheWriteReject = reject
      }).catch((err) => {
        body.emit('error', err)
      })

      body = new CachingMinipassPipeline({ events: ['integrity', 'size'] }, new MinipassFlush({
        flush () {
          return cacheWritePromise
        },
      }))
      // this is always true since if we aren't reusing the one from the remote fetch, we
      // are using the one from cacache
      body.hasIntegrityEmitter = true

      const onResume = () => {
        const tee = new Minipass()
        const cacheStream = cacache.put.stream(this.options.cachePath, this.key, cacheOpts)
        // re-emit the integrity and size events on our new response body so they can be reused
        cacheStream.on('integrity', i => body.emit('integrity', i))
        cacheStream.on('size', s => body.emit('size', s))
        // stick a flag on here so downstream users will know if they can expect integrity events
        tee.pipe(cacheStream)
        // TODO if the cache write fails, log a warning but return the response anyway
        // eslint-disable-next-line promise/catch-or-return
        cacheStream.promise().then(cacheWriteResolve, cacheWriteReject)
        body.unshift(tee)
        body.unshift(this.response.body)
      }

      body.once('resume', onResume)
      body.once('end', () => body.removeListener('resume', onResume))
    } else {
      await cacache.index.insert(this.options.cachePath, this.key, null, cacheOpts)
    }

    // note: we do not set the x-local-cache-hash header because we do not know
    // the hash value until after the write to the cache completes, which doesn't
    // happen until after the response has been sent and it's too late to write
    // the header anyway
    this.response.headers.set('x-local-cache', encodeURIComponent(this.options.cachePath))
    this.response.headers.set('x-local-cache-key', encodeURIComponent(this.key))
    this.response.headers.set('x-local-cache-mode', 'stream')
    this.response.headers.set('x-local-cache-status', status)
    this.response.headers.set('x-local-cache-time', new Date().toISOString())
    const newResponse = new Response(body, {
      url: this.response.url,
      status: this.response.status,
      headers: this.response.headers,
      counter: this.options.counter,
    })
    return newResponse
  }

  // use the cached data to create a response and return it
  async respond (method, options, status) {
    let response
    if (method === 'HEAD' || [301, 308].includes(this.response.status)) {
      // if the request is a HEAD, or the response is a redirect,
      // then the metadata in the entry already includes everything
      // we need to build a response
      response = this.response
    } else {
      // we're responding with a full cached response, so create a body
      // that reads from cacache and attach it to a new Response
      const body = new Minipass()
      const headers = { ...this.policy.responseHeaders() }

      const onResume = () => {
        const cacheStream = cacache.get.stream.byDigest(
          this.options.cachePath, this.entry.integrity, { memoize: this.options.memoize }
        )
        cacheStream.on('error', async (err) => {
          cacheStream.pause()
          if (err.code === 'EINTEGRITY') {
            await cacache.rm.content(
              this.options.cachePath, this.entry.integrity, { memoize: this.options.memoize }
            )
          }
          if (err.code === 'ENOENT' || err.code === 'EINTEGRITY') {
            await CacheEntry.invalidate(this.request, this.options)
          }
          body.emit('error', err)
          cacheStream.resume()
        })
        // emit the integrity and size events based on our metadata so we're consistent
        body.emit('integrity', this.entry.integrity)
        body.emit('size', Number(headers['content-length']))
        cacheStream.pipe(body)
      }

      body.once('resume', onResume)
      body.once('end', () => body.removeListener('resume', onResume))
      response = new Response(body, {
        url: this.entry.metadata.url,
        counter: options.counter,
        status: 200,
        headers,
      })
    }

    response.headers.set('x-local-cache', encodeURIComponent(this.options.cachePath))
    response.headers.set('x-local-cache-hash', encodeURIComponent(this.entry.integrity))
    response.headers.set('x-local-cache-key', encodeURIComponent(this.key))
    response.headers.set('x-local-cache-mode', 'stream')
    response.headers.set('x-local-cache-status', status)
    response.headers.set('x-local-cache-time', new Date(this.entry.metadata.time).toUTCString())
    return response
  }

  // use the provided request along with this cache entry to
  // revalidate the stored response. returns a response, either
  // from the cache or from the update
  async revalidate (request, options) {
    const revalidateRequest = new Request(request, {
      headers: this.policy.revalidationHeaders(request),
    })

    try {
      // NOTE: be sure to remove the headers property from the
      // user supplied options, since we have already defined
      // them on the new request object. if they're still in the
      // options then those will overwrite the ones from the policy
      var response = await remote(revalidateRequest, {
        ...options,
        headers: undefined,
      })
    } catch (err) {
      // if the network fetch fails, return the stale
      // cached response unless it has a cache-control
      // of 'must-revalidate'
      if (!this.policy.mustRevalidate) {
        return this.respond(request.method, options, 'stale')
      }

      throw err
    }

    if (this.policy.revalidated(revalidateRequest, response)) {
      // we got a 304, write a new index to the cache and respond from cache
      const metadata = getMetadata(request, response, options)
      // 304 responses do not include headers that are specific to the response data
      // since they do not include a body, so we copy values for headers that were
      // in the old cache entry to the new one, if the new metadata does not already
      // include that header
      for (const name of KEEP_RESPONSE_HEADERS) {
        if (
          !hasOwnProperty(metadata.resHeaders, name) &&
          hasOwnProperty(this.entry.metadata.resHeaders, name)
        ) {
          metadata.resHeaders[name] = this.entry.metadata.resHeaders[name]
        }
      }

      for (const name of options.cacheAdditionalHeaders) {
        const inMeta = hasOwnProperty(metadata.resHeaders, name)
        const inEntry = hasOwnProperty(this.entry.metadata.resHeaders, name)
        const inPolicy = hasOwnProperty(this.policy.response.headers, name)

        // if the header is in the existing entry, but it is not in the metadata
        // then we need to write it to the metadata as this will refresh the on-disk cache
        if (!inMeta && inEntry) {
          metadata.resHeaders[name] = this.entry.metadata.resHeaders[name]
        }
        // if the header is in the metadata, but not in the policy, then we need to set
        // it in the policy so that it's included in the immediate response. future
        // responses will load a new cache entry, so we don't need to change that
        if (!inPolicy && inMeta) {
          this.policy.response.headers[name] = metadata.resHeaders[name]
        }
      }

      try {
        await cacache.index.insert(options.cachePath, this.key, this.entry.integrity, {
          size: this.entry.size,
          metadata,
        })
      } catch (err) {
        // if updating the cache index fails, we ignore it and
        // respond anyway
      }
      return this.respond(request.method, options, 'revalidated')
    }

    // if we got a modified response, create a new entry based on it
    const newEntry = new CacheEntry({
      request,
      response,
      options,
    })

    // respond with the new entry while writing it to the cache
    return newEntry.store('updated')
  }
}

module.exports = CacheEntry


/***/ }),

/***/ 96520:
/***/ ((module) => {

class NotCachedError extends Error {
  constructor (url) {
    /* eslint-disable-next-line max-len */
    super(`request to ${url} failed: cache mode is 'only-if-cached' but no cached response is available.`)
    this.code = 'ENOTCACHED'
  }
}

module.exports = {
  NotCachedError,
}


/***/ }),

/***/ 41567:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const { NotCachedError } = __nccwpck_require__(96520)
const CacheEntry = __nccwpck_require__(46967)
const remote = __nccwpck_require__(20598)

// do whatever is necessary to get a Response and return it
const cacheFetch = async (request, options) => {
  // try to find a cached entry that satisfies this request
  const entry = await CacheEntry.find(request, options)
  if (!entry) {
    // no cached result, if the cache mode is 'only-if-cached' that's a failure
    if (options.cache === 'only-if-cached') {
      throw new NotCachedError(request.url)
    }

    // otherwise, we make a request, store it and return it
    const response = await remote(request, options)
    const newEntry = new CacheEntry({ request, response, options })
    return newEntry.store('miss')
  }

  // we have a cached response that satisfies this request, however if the cache
  // mode is 'no-cache' then we send the revalidation request no matter what
  if (options.cache === 'no-cache') {
    return entry.revalidate(request, options)
  }

  // if the cached entry is not stale, or if the cache mode is 'force-cache' or
  // 'only-if-cached' we can respond with the cached entry. set the status
  // based on the result of needsRevalidation and respond
  const _needsRevalidation = entry.policy.needsRevalidation(request)
  if (options.cache === 'force-cache' ||
      options.cache === 'only-if-cached' ||
      !_needsRevalidation) {
    return entry.respond(request.method, options, _needsRevalidation ? 'stale' : 'hit')
  }

  // if we got here, the cache entry is stale so revalidate it
  return entry.revalidate(request, options)
}

cacheFetch.invalidate = async (request, options) => {
  if (!options.cachePath) {
    return
  }

  return CacheEntry.invalidate(request, options)
}

module.exports = cacheFetch


/***/ }),

/***/ 14296:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const { URL, format } = __nccwpck_require__(87016)

// options passed to url.format() when generating a key
const formatOptions = {
  auth: false,
  fragment: false,
  search: true,
  unicode: false,
}

// returns a string to be used as the cache key for the Request
const cacheKey = (request) => {
  const parsed = new URL(request.url)
  return `make-fetch-happen:request-cache:${format(parsed, formatOptions)}`
}

module.exports = cacheKey


/***/ }),

/***/ 61097:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const CacheSemantics = __nccwpck_require__(12203)
const Negotiator = __nccwpck_require__(60668)
const ssri = __nccwpck_require__(68951)

// options passed to http-cache-semantics constructor
const policyOptions = {
  shared: false,
  ignoreCargoCult: true,
}

// a fake empty response, used when only testing the
// request for storability
const emptyResponse = { status: 200, headers: {} }

// returns a plain object representation of the Request
const requestObject = (request) => {
  const _obj = {
    method: request.method,
    url: request.url,
    headers: {},
    compress: request.compress,
  }

  request.headers.forEach((value, key) => {
    _obj.headers[key] = value
  })

  return _obj
}

// returns a plain object representation of the Response
const responseObject = (response) => {
  const _obj = {
    status: response.status,
    headers: {},
  }

  response.headers.forEach((value, key) => {
    _obj.headers[key] = value
  })

  return _obj
}

class CachePolicy {
  constructor ({ entry, request, response, options }) {
    this.entry = entry
    this.request = requestObject(request)
    this.response = responseObject(response)
    this.options = options
    this.policy = new CacheSemantics(this.request, this.response, policyOptions)

    if (this.entry) {
      // if we have an entry, copy the timestamp to the _responseTime
      // this is necessary because the CacheSemantics constructor forces
      // the value to Date.now() which means a policy created from a
      // cache entry is likely to always identify itself as stale
      this.policy._responseTime = this.entry.metadata.time
    }
  }

  // static method to quickly determine if a request alone is storable
  static storable (request, options) {
    // no cachePath means no caching
    if (!options.cachePath) {
      return false
    }

    // user explicitly asked not to cache
    if (options.cache === 'no-store') {
      return false
    }

    // we only cache GET and HEAD requests
    if (!['GET', 'HEAD'].includes(request.method)) {
      return false
    }

    // otherwise, let http-cache-semantics make the decision
    // based on the request's headers
    const policy = new CacheSemantics(requestObject(request), emptyResponse, policyOptions)
    return policy.storable()
  }

  // returns true if the policy satisfies the request
  satisfies (request) {
    const _req = requestObject(request)
    if (this.request.headers.host !== _req.headers.host) {
      return false
    }

    if (this.request.compress !== _req.compress) {
      return false
    }

    const negotiatorA = new Negotiator(this.request)
    const negotiatorB = new Negotiator(_req)

    if (JSON.stringify(negotiatorA.mediaTypes()) !== JSON.stringify(negotiatorB.mediaTypes())) {
      return false
    }

    if (JSON.stringify(negotiatorA.languages()) !== JSON.stringify(negotiatorB.languages())) {
      return false
    }

    if (JSON.stringify(negotiatorA.encodings()) !== JSON.stringify(negotiatorB.encodings())) {
      return false
    }

    if (this.options.integrity) {
      return ssri.parse(this.options.integrity).match(this.entry.integrity)
    }

    return true
  }

  // returns true if the request and response allow caching
  storable () {
    return this.policy.storable()
  }

  // NOTE: this is a hack to avoid parsing the cache-control
  // header ourselves, it returns true if the response's
  // cache-control contains must-revalidate
  get mustRevalidate () {
    return !!this.policy._rescc['must-revalidate']
  }

  // returns true if the cached response requires revalidation
  // for the given request
  needsRevalidation (request) {
    const _req = requestObject(request)
    // force method to GET because we only cache GETs
    // but can serve a HEAD from a cached GET
    _req.method = 'GET'
    return !this.policy.satisfiesWithoutRevalidation(_req)
  }

  responseHeaders () {
    return this.policy.responseHeaders()
  }

  // returns a new object containing the appropriate headers
  // to send a revalidation request
  revalidationHeaders (request) {
    const _req = requestObject(request)
    return this.policy.revalidationHeaders(_req)
  }

  // returns true if the request/response was revalidated
  // successfully. returns false if a new response was received
  revalidated (request, response) {
    const _req = requestObject(request)
    const _res = responseObject(response)
    const policy = this.policy.revalidatedPolicy(_req, _res)
    return !policy.modified
  }
}

module.exports = CachePolicy


/***/ }),

/***/ 29026:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const { FetchError, Request, isRedirect } = __nccwpck_require__(88483)
const url = __nccwpck_require__(87016)

const CachePolicy = __nccwpck_require__(61097)
const cache = __nccwpck_require__(41567)
const remote = __nccwpck_require__(20598)

// given a Request, a Response and user options
// return true if the response is a redirect that
// can be followed. we throw errors that will result
// in the fetch being rejected if the redirect is
// possible but invalid for some reason
const canFollowRedirect = (request, response, options) => {
  if (!isRedirect(response.status)) {
    return false
  }

  if (options.redirect === 'manual') {
    return false
  }

  if (options.redirect === 'error') {
    throw new FetchError(`redirect mode is set to error: ${request.url}`,
      'no-redirect', { code: 'ENOREDIRECT' })
  }

  if (!response.headers.has('location')) {
    throw new FetchError(`redirect location header missing for: ${request.url}`,
      'no-location', { code: 'EINVALIDREDIRECT' })
  }

  if (request.counter >= request.follow) {
    throw new FetchError(`maximum redirect reached at: ${request.url}`,
      'max-redirect', { code: 'EMAXREDIRECT' })
  }

  return true
}

// given a Request, a Response, and the user's options return an object
// with a new Request and a new options object that will be used for
// following the redirect
const getRedirect = (request, response, options) => {
  const _opts = { ...options }
  const location = response.headers.get('location')
  const redirectUrl = new url.URL(location, /^https?:/.test(location) ? undefined : request.url)
  // Comment below is used under the following license:
  /**
   * @license
   * Copyright (c) 2010-2012 Mikeal Rogers
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   * http://www.apache.org/licenses/LICENSE-2.0
   * Unless required by applicable law or agreed to in writing,
   * software distributed under the License is distributed on an "AS
   * IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
   * express or implied. See the License for the specific language
   * governing permissions and limitations under the License.
   */

  // Remove authorization if changing hostnames (but not if just
  // changing ports or protocols).  This matches the behavior of request:
  // https://github.com/request/request/blob/b12a6245/lib/redirect.js#L134-L138
  if (new url.URL(request.url).hostname !== redirectUrl.hostname) {
    request.headers.delete('authorization')
    request.headers.delete('cookie')
  }

  // for POST request with 301/302 response, or any request with 303 response,
  // use GET when following redirect
  if (
    response.status === 303 ||
    (request.method === 'POST' && [301, 302].includes(response.status))
  ) {
    _opts.method = 'GET'
    _opts.body = null
    request.headers.delete('content-length')
  }

  _opts.headers = {}
  request.headers.forEach((value, key) => {
    _opts.headers[key] = value
  })

  _opts.counter = ++request.counter
  const redirectReq = new Request(url.format(redirectUrl), _opts)
  return {
    request: redirectReq,
    options: _opts,
  }
}

const fetch = async (request, options) => {
  const response = CachePolicy.storable(request, options)
    ? await cache(request, options)
    : await remote(request, options)

  // if the request wasn't a GET or HEAD, and the response
  // status is between 200 and 399 inclusive, invalidate the
  // request url
  if (!['GET', 'HEAD'].includes(request.method) &&
      response.status >= 200 &&
      response.status <= 399) {
    await cache.invalidate(request, options)
  }

  if (!canFollowRedirect(request, response, options)) {
    return response
  }

  const redirect = getRedirect(request, response, options)
  return fetch(redirect.request, redirect.options)
}

module.exports = fetch


/***/ }),

/***/ 40614:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const { FetchError, Headers, Request, Response } = __nccwpck_require__(88483)

const configureOptions = __nccwpck_require__(82936)
const fetch = __nccwpck_require__(29026)

const makeFetchHappen = (url, opts) => {
  const options = configureOptions(opts)

  const request = new Request(url, options)
  return fetch(request, options)
}

makeFetchHappen.defaults = (defaultUrl, defaultOptions = {}, wrappedFetch = makeFetchHappen) => {
  if (typeof defaultUrl === 'object') {
    defaultOptions = defaultUrl
    defaultUrl = null
  }

  const defaultedFetch = (url, options = {}) => {
    const finalUrl = url || defaultUrl
    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    }
    return wrappedFetch(finalUrl, finalOptions)
  }

  defaultedFetch.defaults = (defaultUrl1, defaultOptions1 = {}) =>
    makeFetchHappen.defaults(defaultUrl1, defaultOptions1, defaultedFetch)
  return defaultedFetch
}

module.exports = makeFetchHappen
module.exports.FetchError = FetchError
module.exports.Headers = Headers
module.exports.Request = Request
module.exports.Response = Response


/***/ }),

/***/ 82936:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const dns = __nccwpck_require__(72250)

const conditionalHeaders = [
  'if-modified-since',
  'if-none-match',
  'if-unmodified-since',
  'if-match',
  'if-range',
]

const configureOptions = (opts) => {
  const { strictSSL, ...options } = { ...opts }
  options.method = options.method ? options.method.toUpperCase() : 'GET'

  if (strictSSL === undefined || strictSSL === null) {
    options.rejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0'
  } else {
    options.rejectUnauthorized = strictSSL !== false
  }

  if (!options.retry) {
    options.retry = { retries: 0 }
  } else if (typeof options.retry === 'string') {
    const retries = parseInt(options.retry, 10)
    if (isFinite(retries)) {
      options.retry = { retries }
    } else {
      options.retry = { retries: 0 }
    }
  } else if (typeof options.retry === 'number') {
    options.retry = { retries: options.retry }
  } else {
    options.retry = { retries: 0, ...options.retry }
  }

  options.dns = { ttl: 5 * 60 * 1000, lookup: dns.lookup, ...options.dns }

  options.cache = options.cache || 'default'
  if (options.cache === 'default') {
    const hasConditionalHeader = Object.keys(options.headers || {}).some((name) => {
      return conditionalHeaders.includes(name.toLowerCase())
    })
    if (hasConditionalHeader) {
      options.cache = 'no-store'
    }
  }

  options.cacheAdditionalHeaders = options.cacheAdditionalHeaders || []

  // cacheManager is deprecated, but if it's set and
  // cachePath is not we should copy it to the new field
  if (options.cacheManager && !options.cachePath) {
    options.cachePath = options.cacheManager
  }

  return options
}

module.exports = configureOptions


/***/ }),

/***/ 94210:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const MinipassPipeline = __nccwpck_require__(52899)

class CachingMinipassPipeline extends MinipassPipeline {
  #events = []
  #data = new Map()

  constructor (opts, ...streams) {
    // CRITICAL: do NOT pass the streams to the call to super(), this will start
    // the flow of data and potentially cause the events we need to catch to emit
    // before we've finished our own setup. instead we call super() with no args,
    // finish our setup, and then push the streams into ourselves to start the
    // data flow
    super()
    this.#events = opts.events

    /* istanbul ignore next - coverage disabled because this is pointless to test here */
    if (streams.length) {
      this.push(...streams)
    }
  }

  on (event, handler) {
    if (this.#events.includes(event) && this.#data.has(event)) {
      return handler(...this.#data.get(event))
    }

    return super.on(event, handler)
  }

  emit (event, ...data) {
    if (this.#events.includes(event)) {
      this.#data.set(event, data)
    }

    return super.emit(event, ...data)
  }
}

module.exports = CachingMinipassPipeline


/***/ }),

/***/ 20598:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

const { Minipass } = __nccwpck_require__(78275)
const fetch = __nccwpck_require__(88483)
const promiseRetry = __nccwpck_require__(90390)
const ssri = __nccwpck_require__(68951)
const { log } = __nccwpck_require__(26687)

const CachingMinipassPipeline = __nccwpck_require__(94210)
const { getAgent } = __nccwpck_require__(57995)
const pkg = __nccwpck_require__(53644)

const USER_AGENT = `${pkg.name}/${pkg.version} (+https://npm.im/${pkg.name})`

const RETRY_ERRORS = [
  'ECONNRESET', // remote socket closed on us
  'ECONNREFUSED', // remote host refused to open connection
  'EADDRINUSE', // failed to bind to a local port (proxy?)
  'ETIMEDOUT', // someone in the transaction is WAY TOO SLOW
  // from @npmcli/agent
  'ECONNECTIONTIMEOUT',
  'EIDLETIMEOUT',
  'ERESPONSETIMEOUT',
  'ETRANSFERTIMEOUT',
  // Known codes we do NOT retry on:
  // ENOTFOUND (getaddrinfo failure. Either bad hostname, or offline)
  // EINVALIDPROXY // invalid protocol from @npmcli/agent
  // EINVALIDRESPONSE // invalid status code from @npmcli/agent
]

const RETRY_TYPES = [
  'request-timeout',
]

// make a request directly to the remote source,
// retrying certain classes of errors as well as
// following redirects (through the cache if necessary)
// and verifying response integrity
const remoteFetch = (request, options) => {
  // options.signal is intended for the fetch itself, not the agent.  Attaching it to the agent will re-use that signal across multiple requests, which prevents any connections beyond the first one.
  const agent = getAgent(request.url, { ...options, signal: undefined })
  if (!request.headers.has('connection')) {
    request.headers.set('connection', agent ? 'keep-alive' : 'close')
  }

  if (!request.headers.has('user-agent')) {
    request.headers.set('user-agent', USER_AGENT)
  }

  // keep our own options since we're overriding the agent
  // and the redirect mode
  const _opts = {
    ...options,
    agent,
    redirect: 'manual',
  }

  return promiseRetry(async (retryHandler, attemptNum) => {
    const req = new fetch.Request(request, _opts)
    try {
      let res = await fetch(req, _opts)
      if (_opts.integrity && res.status === 200) {
        // we got a 200 response and the user has specified an expected
        // integrity value, so wrap the response in an ssri stream to verify it
        const integrityStream = ssri.integrityStream({
          algorithms: _opts.algorithms,
          integrity: _opts.integrity,
          size: _opts.size,
        })
        const pipeline = new CachingMinipassPipeline({
          events: ['integrity', 'size'],
        }, res.body, integrityStream)
        // we also propagate the integrity and size events out to the pipeline so we can use
        // this new response body as an integrityEmitter for cacache
        integrityStream.on('integrity', i => pipeline.emit('integrity', i))
        integrityStream.on('size', s => pipeline.emit('size', s))
        res = new fetch.Response(pipeline, res)
        // set an explicit flag so we know if our response body will emit integrity and size
        res.body.hasIntegrityEmitter = true
      }

      res.headers.set('x-fetch-attempts', attemptNum)

      // do not retry POST requests, or requests with a streaming body
      // do retry requests with a 408, 420, 429 or 500+ status in the response
      const isStream = Minipass.isStream(req.body)
      const isRetriable = req.method !== 'POST' &&
          !isStream &&
          ([408, 420, 429].includes(res.status) || res.status >= 500)

      if (isRetriable) {
        if (typeof options.onRetry === 'function') {
          options.onRetry(res)
        }

        /* eslint-disable-next-line max-len */
        log.http('fetch', `${req.method} ${req.url} attempt ${attemptNum} failed with ${res.status}`)
        return retryHandler(res)
      }

      return res
    } catch (err) {
      const code = (err.code === 'EPROMISERETRY')
        ? err.retried.code
        : err.code

      // err.retried will be the thing that was thrown from above
      // if it's a response, we just got a bad status code and we
      // can re-throw to allow the retry
      const isRetryError = err.retried instanceof fetch.Response ||
        (RETRY_ERRORS.includes(code) && RETRY_TYPES.includes(err.type))

      if (req.method === 'POST' || isRetryError) {
        throw err
      }

      if (typeof options.onRetry === 'function') {
        options.onRetry(err)
      }

      log.http('fetch', `${req.method} ${req.url} attempt ${attemptNum} failed with ${err.code}`)
      return retryHandler(err)
    }
  }, options.retry).catch((err) => {
    // don't reject for http errors, just return them
    if (err.status >= 400 && err.type !== 'system') {
      return err
    }

    throw err
  })
}

module.exports = remoteFetch


/***/ }),

/***/ 47030:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

/* eslint-disable */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Signature = exports.Envelope = void 0;
function createBaseEnvelope() {
    return { payload: Buffer.alloc(0), payloadType: "", signatures: [] };
}
exports.Envelope = {
    fromJSON(object) {
        return {
            payload: isSet(object.payload) ? Buffer.from(bytesFromBase64(object.payload)) : Buffer.alloc(0),
            payloadType: isSet(object.payloadType) ? String(object.payloadType) : "",
            signatures: Array.isArray(object?.signatures) ? object.signatures.map((e) => exports.Signature.fromJSON(e)) : [],
        };
    },
    toJSON(message) {
        const obj = {};
        message.payload !== undefined &&
            (obj.payload = base64FromBytes(message.payload !== undefined ? message.payload : Buffer.alloc(0)));
        message.payloadType !== undefined && (obj.payloadType = message.payloadType);
        if (message.signatures) {
            obj.signatures = message.signatures.map((e) => e ? exports.Signature.toJSON(e) : undefined);
        }
        else {
            obj.signatures = [];
        }
        return obj;
    },
};
function createBaseSignature() {
    return { sig: Buffer.alloc(0), keyid: "" };
}
exports.Signature = {
    fromJSON(object) {
        return {
            sig: isSet(object.sig) ? Buffer.from(bytesFromBase64(object.sig)) : Buffer.alloc(0),
            keyid: isSet(object.keyid) ? String(object.keyid) : "",
        };
    },
    toJSON(message) {
        const obj = {};
        message.sig !== undefined && (obj.sig = base64FromBytes(message.sig !== undefined ? message.sig : Buffer.alloc(0)));
        message.keyid !== undefined && (obj.keyid = message.keyid);
        return obj;
    },
};
var tsProtoGlobalThis = (() => {
    if (typeof globalThis !== "undefined") {
        return globalThis;
    }
    if (typeof self !== "undefined") {
        return self;
    }
    if (typeof window !== "undefined") {
        return window;
    }
    if (typeof global !== "undefined") {
        return global;
    }
    throw "Unable to locate global object";
})();
function bytesFromBase64(b64) {
    if (tsProtoGlobalThis.Buffer) {
        return Uint8Array.from(tsProtoGlobalThis.Buffer.from(b64, "base64"));
    }
    else {
        const bin = tsProtoGlobalThis.atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; ++i) {
            arr[i] = bin.charCodeAt(i);
        }
        return arr;
    }
}
function base64FromBytes(arr) {
    if (tsProtoGlobalThis.Buffer) {
        return tsProtoGlobalThis.Buffer.from(arr).toString("base64");
    }
    else {
        const bin = [];
        arr.forEach((byte) => {
            bin.push(String.fromCharCode(byte));
        });
        return tsProtoGlobalThis.btoa(bin.join(""));
    }
}
function isSet(value) {
    return value !== null && value !== undefined;
}


/***/ }),

/***/ 45000:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

/* eslint-disable */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Timestamp = void 0;
function createBaseTimestamp() {
    return { seconds: "0", nanos: 0 };
}
exports.Timestamp = {
    fromJSON(object) {
        return {
            seconds: isSet(object.seconds) ? String(object.seconds) : "0",
            nanos: isSet(object.nanos) ? Number(object.nanos) : 0,
        };
    },
    toJSON(message) {
        const obj = {};
        message.seconds !== undefined && (obj.seconds = message.seconds);
        message.nanos !== undefined && (obj.nanos = Math.round(message.nanos));
        return obj;
    },
};
function isSet(value) {
    return value !== null && value !== undefined;
}


/***/ }),

/***/ 70715:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Bundle = exports.VerificationMaterial = exports.TimestampVerificationData = void 0;
/* eslint-disable */
const envelope_1 = __nccwpck_require__(47030);
const sigstore_common_1 = __nccwpck_require__(5334);
const sigstore_rekor_1 = __nccwpck_require__(85204);
function createBaseTimestampVerificationData() {
    return { rfc3161Timestamps: [] };
}
exports.TimestampVerificationData = {
    fromJSON(object) {
        return {
            rfc3161Timestamps: Array.isArray(object?.rfc3161Timestamps)
                ? object.rfc3161Timestamps.map((e) => sigstore_common_1.RFC3161SignedTimestamp.fromJSON(e))
                : [],
        };
    },
    toJSON(message) {
        const obj = {};
        if (message.rfc3161Timestamps) {
            obj.rfc3161Timestamps = message.rfc3161Timestamps.map((e) => e ? sigstore_common_1.RFC3161SignedTimestamp.toJSON(e) : undefined);
        }
        else {
            obj.rfc3161Timestamps = [];
        }
        return obj;
    },
};
function createBaseVerificationMaterial() {
    return { content: undefined, tlogEntries: [], timestampVerificationData: undefined };
}
exports.VerificationMaterial = {
    fromJSON(object) {
        return {
            content: isSet(object.publicKey)
                ? { $case: "publicKey", publicKey: sigstore_common_1.PublicKeyIdentifier.fromJSON(object.publicKey) }
                : isSet(object.x509CertificateChain)
                    ? {
                        $case: "x509CertificateChain",
                        x509CertificateChain: sigstore_common_1.X509CertificateChain.fromJSON(object.x509CertificateChain),
                    }
                    : isSet(object.certificate)
                        ? { $case: "certificate", certificate: sigstore_common_1.X509Certificate.fromJSON(object.certificate) }
                        : undefined,
            tlogEntries: Array.isArray(object?.tlogEntries)
                ? object.tlogEntries.map((e) => sigstore_rekor_1.TransparencyLogEntry.fromJSON(e))
                : [],
            timestampVerificationData: isSet(object.timestampVerificationData)
                ? exports.TimestampVerificationData.fromJSON(object.timestampVerificationData)
                : undefined,
        };
    },
    toJSON(message) {
        const obj = {};
        message.content?.$case === "publicKey" &&
            (obj.publicKey = message.content?.publicKey ? sigstore_common_1.PublicKeyIdentifier.toJSON(message.content?.publicKey) : undefined);
        message.content?.$case === "x509CertificateChain" &&
            (obj.x509CertificateChain = message.content?.x509CertificateChain
                ? sigstore_common_1.X509CertificateChain.toJSON(message.content?.x509CertificateChain)
                : undefined);
        message.content?.$case === "certificate" &&
            (obj.certificate = message.content?.certificate
                ? sigstore_common_1.X509Certificate.toJSON(message.content?.certificate)
                : undefined);
        if (message.tlogEntries) {
            obj.tlogEntries = message.tlogEntries.map((e) => e ? sigstore_rekor_1.TransparencyLogEntry.toJSON(e) : undefined);
        }
        else {
            obj.tlogEntries = [];
        }
        message.timestampVerificationData !== undefined &&
            (obj.timestampVerificationData = message.timestampVerificationData
                ? exports.TimestampVerificationData.toJSON(message.timestampVerificationData)
                : undefined);
        return obj;
    },
};
function createBaseBundle() {
    return { mediaType: "", verificationMaterial: undefined, content: undefined };
}
exports.Bundle = {
    fromJSON(object) {
        return {
            mediaType: isSet(object.mediaType) ? String(object.mediaType) : "",
            verificationMaterial: isSet(object.verificationMaterial)
                ? exports.VerificationMaterial.fromJSON(object.verificationMaterial)
                : undefined,
            content: isSet(object.messageSignature)
                ? { $case: "messageSignature", messageSignature: sigstore_common_1.MessageSignature.fromJSON(object.messageSignature) }
                : isSet(object.dsseEnvelope)
                    ? { $case: "dsseEnvelope", dsseEnvelope: envelope_1.Envelope.fromJSON(object.dsseEnvelope) }
                    : undefined,
        };
    },
    toJSON(message) {
        const obj = {};
        message.mediaType !== undefined && (obj.mediaType = message.mediaType);
        message.verificationMaterial !== undefined && (obj.verificationMaterial = message.verificationMaterial
            ? exports.VerificationMaterial.toJSON(message.verificationMaterial)
            : undefined);
        message.content?.$case === "messageSignature" && (obj.messageSignature = message.content?.messageSignature
            ? sigstore_common_1.MessageSignature.toJSON(message.content?.messageSignature)
            : undefined);
        message.content?.$case === "dsseEnvelope" &&
            (obj.dsseEnvelope = message.content?.dsseEnvelope ? envelope_1.Envelope.toJSON(message.content?.dsseEnvelope) : undefined);
        return obj;
    },
};
function isSet(value) {
    return value !== null && value !== undefined;
}


/***/ }),

/***/ 5334:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TimeRange = exports.X509CertificateChain = exports.SubjectAlternativeName = exports.X509Certificate = exports.DistinguishedName = exports.ObjectIdentifierValuePair = exports.ObjectIdentifier = exports.PublicKeyIdentifier = exports.PublicKey = exports.RFC3161SignedTimestamp = exports.LogId = exports.MessageSignature = exports.HashOutput = exports.subjectAlternativeNameTypeToJSON = exports.subjectAlternativeNameTypeFromJSON = exports.SubjectAlternativeNameType = exports.publicKeyDetailsToJSON = exports.publicKeyDetailsFromJSON = exports.PublicKeyDetails = exports.hashAlgorithmToJSON = exports.hashAlgorithmFromJSON = exports.HashAlgorithm = void 0;
/* eslint-disable */
const timestamp_1 = __nccwpck_require__(45000);
/**
 * Only a subset of the secure hash standard algorithms are supported.
 * See <https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf> for more
 * details.
 * UNSPECIFIED SHOULD not be used, primary reason for inclusion is to force
 * any proto JSON serialization to emit the used hash algorithm, as default
 * option is to *omit* the default value of an enum (which is the first
 * value, represented by '0'.
 */
var HashAlgorithm;
(function (HashAlgorithm) {
    HashAlgorithm[HashAlgorithm["HASH_ALGORITHM_UNSPECIFIED"] = 0] = "HASH_ALGORITHM_UNSPECIFIED";
    HashAlgorithm[HashAlgorithm["SHA2_256"] = 1] = "SHA2_256";
    HashAlgorithm[HashAlgorithm["SHA2_384"] = 2] = "SHA2_384";
    HashAlgorithm[HashAlgorithm["SHA2_512"] = 3] = "SHA2_512";
    HashAlgorithm[HashAlgorithm["SHA3_256"] = 4] = "SHA3_256";
    HashAlgorithm[HashAlgorithm["SHA3_384"] = 5] = "SHA3_384";
})(HashAlgorithm = exports.HashAlgorithm || (exports.HashAlgorithm = {}));
function hashAlgorithmFromJSON(object) {
    switch (object) {
        case 0:
        case "HASH_ALGORITHM_UNSPECIFIED":
            return HashAlgorithm.HASH_ALGORITHM_UNSPECIFIED;
        case 1:
        case "SHA2_256":
            return HashAlgorithm.SHA2_256;
        case 2:
        case "SHA2_384":
            return HashAlgorithm.SHA2_384;
        case 3:
        case "SHA2_512":
            return HashAlgorithm.SHA2_512;
        case 4:
        case "SHA3_256":
            return HashAlgorithm.SHA3_256;
        case 5:
        case "SHA3_384":
            return HashAlgorithm.SHA3_384;
        default:
            throw new tsProtoGlobalThis.Error("Unrecognized enum value " + object + " for enum HashAlgorithm");
    }
}
exports.hashAlgorithmFromJSON = hashAlgorithmFromJSON;
function hashAlgorithmToJSON(object) {
    switch (object) {
        case HashAlgorithm.HASH_ALGORITHM_UNSPECIFIED:
            return "HASH_ALGORITHM_UNSPECIFIED";
        case HashAlgorithm.SHA2_256:
            return "SHA2_256";
        case HashAlgorithm.SHA2_384:
            return "SHA2_384";
        case HashAlgorithm.SHA2_512:
            return "SHA2_512";
        case HashAlgorithm.SHA3_256:
            return "SHA3_256";
        case HashAlgorithm.SHA3_384:
            return "SHA3_384";
        default:
            throw new tsProtoGlobalThis.Error("Unrecognized enum value " + object + " for enum HashAlgorithm");
    }
}
exports.hashAlgorithmToJSON = hashAlgorithmToJSON;
/**
 * Details of a specific public key, capturing the the key encoding method,
 * and signature algorithm.
 *
 * PublicKeyDetails captures the public key/hash algorithm combinations
 * recommended in the Sigstore ecosystem.
 *
 * This is modelled as a linear set as we want to provide a small number of
 * opinionated options instead of allowing every possible permutation.
 *
 * Any changes to this enum MUST be reflected in the algorithm registry.
 * See: docs/algorithm-registry.md
 *
 * To avoid the possibility of contradicting formats such as PKCS1 with
 * ED25519 the valid permutations are listed as a linear set instead of a
 * cartesian set (i.e one combined variable instead of two, one for encoding
 * and one for the signature algorithm).
 */
var PublicKeyDetails;
(function (PublicKeyDetails) {
    PublicKeyDetails[PublicKeyDetails["PUBLIC_KEY_DETAILS_UNSPECIFIED"] = 0] = "PUBLIC_KEY_DETAILS_UNSPECIFIED";
    /**
     * PKCS1_RSA_PKCS1V5 - RSA
     *
     * @deprecated
     */
    PublicKeyDetails[PublicKeyDetails["PKCS1_RSA_PKCS1V5"] = 1] = "PKCS1_RSA_PKCS1V5";
    /**
     * PKCS1_RSA_PSS - See RFC8017
     *
     * @deprecated
     */
    PublicKeyDetails[PublicKeyDetails["PKCS1_RSA_PSS"] = 2] = "PKCS1_RSA_PSS";
    /** @deprecated */
    PublicKeyDetails[PublicKeyDetails["PKIX_RSA_PKCS1V5"] = 3] = "PKIX_RSA_PKCS1V5";
    /** @deprecated */
    PublicKeyDetails[PublicKeyDetails["PKIX_RSA_PSS"] = 4] = "PKIX_RSA_PSS";
    /** PKIX_RSA_PKCS1V15_2048_SHA256 - RSA public key in PKIX format, PKCS#1v1.5 signature */
    PublicKeyDetails[PublicKeyDetails["PKIX_RSA_PKCS1V15_2048_SHA256"] = 9] = "PKIX_RSA_PKCS1V15_2048_SHA256";
    PublicKeyDetails[PublicKeyDetails["PKIX_RSA_PKCS1V15_3072_SHA256"] = 10] = "PKIX_RSA_PKCS1V15_3072_SHA256";
    PublicKeyDetails[PublicKeyDetails["PKIX_RSA_PKCS1V15_4096_SHA256"] = 11] = "PKIX_RSA_PKCS1V15_4096_SHA256";
    /** PKIX_RSA_PSS_2048_SHA256 - RSA public key in PKIX format, RSASSA-PSS signature */
    PublicKeyDetails[PublicKeyDetails["PKIX_RSA_PSS_2048_SHA256"] = 16] = "PKIX_RSA_PSS_2048_SHA256";
    PublicKeyDetails[PublicKeyDetails["PKIX_RSA_PSS_3072_SHA256"] = 17] = "PKIX_RSA_PSS_3072_SHA256";
    PublicKeyDetails[PublicKeyDetails["PKIX_RSA_PSS_4096_SHA256"] = 18] = "PKIX_RSA_PSS_4096_SHA256";
    /**
     * PKIX_ECDSA_P256_HMAC_SHA_256 - ECDSA
     *
     * @deprecated
     */
    PublicKeyDetails[PublicKeyDetails["PKIX_ECDSA_P256_HMAC_SHA_256"] = 6] = "PKIX_ECDSA_P256_HMAC_SHA_256";
    /** PKIX_ECDSA_P256_SHA_256 - See NIST FIPS 186-4 */
    PublicKeyDetails[PublicKeyDetails["PKIX_ECDSA_P256_SHA_256"] = 5] = "PKIX_ECDSA_P256_SHA_256";
    PublicKeyDetails[PublicKeyDetails["PKIX_ECDSA_P384_SHA_384"] = 12] = "PKIX_ECDSA_P384_SHA_384";
    PublicKeyDetails[PublicKeyDetails["PKIX_ECDSA_P521_SHA_512"] = 13] = "PKIX_ECDSA_P521_SHA_512";
    /** PKIX_ED25519 - Ed 25519 */
    PublicKeyDetails[PublicKeyDetails["PKIX_ED25519"] = 7] = "PKIX_ED25519";
    PublicKeyDetails[PublicKeyDetails["PKIX_ED25519_PH"] = 8] = "PKIX_ED25519_PH";
    /**
     * LMS_SHA256 - LMS and LM-OTS
     *
     * These keys and signatures may be used by private Sigstore
     * deployments, but are not currently supported by the public
     * good instance.
     *
     * USER WARNING: LMS and LM-OTS are both stateful signature schemes.
     * Using them correctly requires discretion and careful consideration
     * to ensure that individual secret keys are not used more than once.
     * In addition, LM-OTS is a single-use scheme, meaning that it
     * MUST NOT be used for more than one signature per LM-OTS key.
     * If you cannot maintain these invariants, you MUST NOT use these
     * schemes.
     */
    PublicKeyDetails[PublicKeyDetails["LMS_SHA256"] = 14] = "LMS_SHA256";
    PublicKeyDetails[PublicKeyDetails["LMOTS_SHA256"] = 15] = "LMOTS_SHA256";
})(PublicKeyDetails = exports.PublicKeyDetails || (exports.PublicKeyDetails = {}));
function publicKeyDetailsFromJSON(object) {
    switch (object) {
        case 0:
        case "PUBLIC_KEY_DETAILS_UNSPECIFIED":
            return PublicKeyDetails.PUBLIC_KEY_DETAILS_UNSPECIFIED;
        case 1:
        case "PKCS1_RSA_PKCS1V5":
            return PublicKeyDetails.PKCS1_RSA_PKCS1V5;
        case 2:
        case "PKCS1_RSA_PSS":
            return PublicKeyDetails.PKCS1_RSA_PSS;
        case 3:
        case "PKIX_RSA_PKCS1V5":
            return PublicKeyDetails.PKIX_RSA_PKCS1V5;
        case 4:
        case "PKIX_RSA_PSS":
            return PublicKeyDetails.PKIX_RSA_PSS;
        case 9:
        case "PKIX_RSA_PKCS1V15_2048_SHA256":
            return PublicKeyDetails.PKIX_RSA_PKCS1V15_2048_SHA256;
        case 10:
        case "PKIX_RSA_PKCS1V15_3072_SHA256":
            return PublicKeyDetails.PKIX_RSA_PKCS1V15_3072_SHA256;
        case 11:
        case "PKIX_RSA_PKCS1V15_4096_SHA256":
            return PublicKeyDetails.PKIX_RSA_PKCS1V15_4096_SHA256;
        case 16:
        case "PKIX_RSA_PSS_2048_SHA256":
            return PublicKeyDetails.PKIX_RSA_PSS_2048_SHA256;
        case 17:
        case "PKIX_RSA_PSS_3072_SHA256":
            return PublicKeyDetails.PKIX_RSA_PSS_3072_SHA256;
        case 18:
        case "PKIX_RSA_PSS_4096_SHA256":
            return PublicKeyDetails.PKIX_RSA_PSS_4096_SHA256;
        case 6:
        case "PKIX_ECDSA_P256_HMAC_SHA_256":
            return PublicKeyDetails.PKIX_ECDSA_P256_HMAC_SHA_256;
        case 5:
        case "PKIX_ECDSA_P256_SHA_256":
            return PublicKeyDetails.PKIX_ECDSA_P256_SHA_256;
        case 12:
        case "PKIX_ECDSA_P384_SHA_384":
            return PublicKeyDetails.PKIX_ECDSA_P384_SHA_384;
        case 13:
        case "PKIX_ECDSA_P521_SHA_512":
            return PublicKeyDetails.PKIX_ECDSA_P521_SHA_512;
        case 7:
        case "PKIX_ED25519":
            return PublicKeyDetails.PKIX_ED25519;
        case 8:
        case "PKIX_ED25519_PH":
            return PublicKeyDetails.PKIX_ED25519_PH;
        case 14:
        case "LMS_SHA256":
            return PublicKeyDetails.LMS_SHA256;
        case 15:
        case "LMOTS_SHA256":
            return PublicKeyDetails.LMOTS_SHA256;
        default:
            throw new tsProtoGlobalThis.Error("Unrecognized enum value " + object + " for enum PublicKeyDetails");
    }
}
exports.publicKeyDetailsFromJSON = publicKeyDetailsFromJSON;
function publicKeyDetailsToJSON(object) {
    switch (object) {
        case PublicKeyDetails.PUBLIC_KEY_DETAILS_UNSPECIFIED:
            return "PUBLIC_KEY_DETAILS_UNSPECIFIED";
        case PublicKeyDetails.PKCS1_RSA_PKCS1V5:
            return "PKCS1_RSA_PKCS1V5";
        case PublicKeyDetails.PKCS1_RSA_PSS:
            return "PKCS1_RSA_PSS";
        case PublicKeyDetails.PKIX_RSA_PKCS1V5:
            return "PKIX_RSA_PKCS1V5";
        case PublicKeyDetails.PKIX_RSA_PSS:
            return "PKIX_RSA_PSS";
        case PublicKeyDetails.PKIX_RSA_PKCS1V15_2048_SHA256:
            return "PKIX_RSA_PKCS1V15_2048_SHA256";
        case PublicKeyDetails.PKIX_RSA_PKCS1V15_3072_SHA256:
            return "PKIX_RSA_PKCS1V15_3072_SHA256";
        case PublicKeyDetails.PKIX_RSA_PKCS1V15_4096_SHA256:
            return "PKIX_RSA_PKCS1V15_4096_SHA256";
        case PublicKeyDetails.PKIX_RSA_PSS_2048_SHA256:
            return "PKIX_RSA_PSS_2048_SHA256";
        case PublicKeyDetails.PKIX_RSA_PSS_3072_SHA256:
            return "PKIX_RSA_PSS_3072_SHA256";
        case PublicKeyDetails.PKIX_RSA_PSS_4096_SHA256:
            return "PKIX_RSA_PSS_4096_SHA256";
        case PublicKeyDetails.PKIX_ECDSA_P256_HMAC_SHA_256:
            return "PKIX_ECDSA_P256_HMAC_SHA_256";
        case PublicKeyDetails.PKIX_ECDSA_P256_SHA_256:
            return "PKIX_ECDSA_P256_SHA_256";
        case PublicKeyDetails.PKIX_ECDSA_P384_SHA_384:
            return "PKIX_ECDSA_P384_SHA_384";
        case PublicKeyDetails.PKIX_ECDSA_P521_SHA_512:
            return "PKIX_ECDSA_P521_SHA_512";
        case PublicKeyDetails.PKIX_ED25519:
            return "PKIX_ED25519";
        case PublicKeyDetails.PKIX_ED25519_PH:
            return "PKIX_ED25519_PH";
        case PublicKeyDetails.LMS_SHA256:
            return "LMS_SHA256";
        case PublicKeyDetails.LMOTS_SHA256:
            return "LMOTS_SHA256";
        default:
            throw new tsProtoGlobalThis.Error("Unrecognized enum value " + object + " for enum PublicKeyDetails");
    }
}
exports.publicKeyDetailsToJSON = publicKeyDetailsToJSON;
var SubjectAlternativeNameType;
(function (SubjectAlternativeNameType) {
    SubjectAlternativeNameType[SubjectAlternativeNameType["SUBJECT_ALTERNATIVE_NAME_TYPE_UNSPECIFIED"] = 0] = "SUBJECT_ALTERNATIVE_NAME_TYPE_UNSPECIFIED";
    SubjectAlternativeNameType[SubjectAlternativeNameType["EMAIL"] = 1] = "EMAIL";
    SubjectAlternativeNameType[SubjectAlternativeNameType["URI"] = 2] = "URI";
    /**
     * OTHER_NAME - OID 1.3.6.1.4.1.57264.1.7
     * See https://github.com/sigstore/fulcio/blob/main/docs/oid-info.md#1361415726417--othername-san
     * for more details.
     */
    SubjectAlternativeNameType[SubjectAlternativeNameType["OTHER_NAME"] = 3] = "OTHER_NAME";
})(SubjectAlternativeNameType = exports.SubjectAlternativeNameType || (exports.SubjectAlternativeNameType = {}));
function subjectAlternativeNameTypeFromJSON(object) {
    switch (object) {
        case 0:
        case "SUBJECT_ALTERNATIVE_NAME_TYPE_UNSPECIFIED":
            return SubjectAlternativeNameType.SUBJECT_ALTERNATIVE_NAME_TYPE_UNSPECIFIED;
        case 1:
        case "EMAIL":
            return SubjectAlternativeNameType.EMAIL;
        case 2:
        case "URI":
            return SubjectAlternativeNameType.URI;
        case 3:
        case "OTHER_NAME":
            return SubjectAlternativeNameType.OTHER_NAME;
        default:
            throw new tsProtoGlobalThis.Error("Unrecognized enum value " + object + " for enum SubjectAlternativeNameType");
    }
}
exports.subjectAlternativeNameTypeFromJSON = subjectAlternativeNameTypeFromJSON;
function subjectAlternativeNameTypeToJSON(object) {
    switch (object) {
        case SubjectAlternativeNameType.SUBJECT_ALTERNATIVE_NAME_TYPE_UNSPECIFIED:
            return "SUBJECT_ALTERNATIVE_NAME_TYPE_UNSPECIFIED";
        case SubjectAlternativeNameType.EMAIL:
            return "EMAIL";
        case SubjectAlternativeNameType.URI:
            return "URI";
        case SubjectAlternativeNameType.OTHER_NAME:
            return "OTHER_NAME";
        default:
            throw new tsProtoGlobalThis.Error("Unrecognized enum value " + object + " for enum SubjectAlternativeNameType");
    }
}
exports.subjectAlternativeNameTypeToJSON = subjectAlternativeNameTypeToJSON;
function createBaseHashOutput() {
    return { algorithm: 0, digest: Buffer.alloc(0) };
}
exports.HashOutput = {
    fromJSON(object) {
        return {
            algorithm: isSet(object.algorithm) ? hashAlgorithmFromJSON(object.algorithm) : 0,
            digest: isSet(object.digest) ? Buffer.from(bytesFromBase64(object.digest)) : Buffer.alloc(0),
        };
    },
    toJSON(message) {
        const obj = {};
        message.algorithm !== undefined && (obj.algorithm = hashAlgorithmToJSON(message.algorithm));
        message.digest !== undefined &&
            (obj.digest = base64FromBytes(message.digest !== undefined ? message.digest : Buffer.alloc(0)));
        return obj;
    },
};
function createBaseMessageSignature() {
    return { messageDigest: undefined, signature: Buffer.alloc(0) };
}
exports.MessageSignature = {
    fromJSON(object) {
        return {
            messageDigest: isSet(object.messageDigest) ? exports.HashOutput.fromJSON(object.messageDigest) : undefined,
            signature: isSet(object.signature) ? Buffer.from(bytesFromBase64(object.signature)) : Buffer.alloc(0),
        };
    },
    toJSON(message) {
        const obj = {};
        message.messageDigest !== undefined &&
            (obj.messageDigest = message.messageDigest ? exports.HashOutput.toJSON(message.messageDigest) : undefined);
        message.signature !== undefined &&
            (obj.signature = base64FromBytes(message.signature !== undefined ? message.signature : Buffer.alloc(0)));
        return obj;
    },
};
function createBaseLogId() {
    return { keyId: Buffer.alloc(0) };
}
exports.LogId = {
    fromJSON(object) {
        return { keyId: isSet(object.keyId) ? Buffer.from(bytesFromBase64(object.keyId)) : Buffer.alloc(0) };
    },
    toJSON(message) {
        const obj = {};
        message.keyId !== undefined &&
            (obj.keyId = base64FromBytes(message.keyId !== undefined ? message.keyId : Buffer.alloc(0)));
        return obj;
    },
};
function createBaseRFC3161SignedTimestamp() {
    return { signedTimestamp: Buffer.alloc(0) };
}
exports.RFC3161SignedTimestamp = {
    fromJSON(object) {
        return {
            signedTimestamp: isSet(object.signedTimestamp)
                ? Buffer.from(bytesFromBase64(object.signedTimestamp))
                : Buffer.alloc(0),
        };
    },
    toJSON(message) {
        const obj = {};
        message.signedTimestamp !== undefined &&
            (obj.signedTimestamp = base64FromBytes(message.signedTimestamp !== undefined ? message.signedTimestamp : Buffer.alloc(0)));
        return obj;
    },
};
function createBasePublicKey() {
    return { rawBytes: undefined, keyDetails: 0, validFor: undefined };
}
exports.PublicKey = {
    fromJSON(object) {
        return {
            rawBytes: isSet(object.rawBytes) ? Buffer.from(bytesFromBase64(object.rawBytes)) : undefined,
            keyDetails: isSet(object.keyDetails) ? publicKeyDetailsFromJSON(object.keyDetails) : 0,
            validFor: isSet(object.validFor) ? exports.TimeRange.fromJSON(object.validFor) : undefined,
        };
    },
    toJSON(message) {
        const obj = {};
        message.rawBytes !== undefined &&
            (obj.rawBytes = message.rawBytes !== undefined ? base64FromBytes(message.rawBytes) : undefined);
        message.keyDetails !== undefined && (obj.keyDetails = publicKeyDetailsToJSON(message.keyDetails));
        message.validFor !== undefined &&
            (obj.validFor = message.validFor ? exports.TimeRange.toJSON(message.validFor) : undefined);
        return obj;
    },
};
function createBasePublicKeyIdentifier() {
    return { hint: "" };
}
exports.PublicKeyIdentifier = {
    fromJSON(object) {
        return { hint: isSet(object.hint) ? String(object.hint) : "" };
    },
    toJSON(message) {
        const obj = {};
        message.hint !== undefined && (obj.hint = message.hint);
        return obj;
    },
};
function createBaseObjectIdentifier() {
    return { id: [] };
}
exports.ObjectIdentifier = {
    fromJSON(object) {
        return { id: Array.isArray(object?.id) ? object.id.map((e) => Number(e)) : [] };
    },
    toJSON(message) {
        const obj = {};
        if (message.id) {
            obj.id = message.id.map((e) => Math.round(e));
        }
        else {
            obj.id = [];
        }
        return obj;
    },
};
function createBaseObjectIdentifierValuePair() {
    return { oid: undefined, value: Buffer.alloc(0) };
}
exports.ObjectIdentifierValuePair = {
    fromJSON(object) {
        return {
            oid: isSet(object.oid) ? exports.ObjectIdentifier.fromJSON(object.oid) : undefined,
            value: isSet(object.value) ? Buffer.from(bytesFromBase64(object.value)) : Buffer.alloc(0),
        };
    },
    toJSON(message) {
        const obj = {};
        message.oid !== undefined && (obj.oid = message.oid ? exports.ObjectIdentifier.toJSON(message.oid) : undefined);
        message.value !== undefined &&
            (obj.value = base64FromBytes(message.value !== undefined ? message.value : Buffer.alloc(0)));
        return obj;
    },
};
function createBaseDistinguishedName() {
    return { organization: "", commonName: "" };
}
exports.DistinguishedName = {
    fromJSON(object) {
        return {
            organization: isSet(object.organization) ? String(object.organization) : "",
            commonName: isSet(object.commonName) ? String(object.commonName) : "",
        };
    },
    toJSON(message) {
        const obj = {};
        message.organization !== undefined && (obj.organization = message.organization);
        message.commonName !== undefined && (obj.commonName = message.commonName);
        return obj;
    },
};
function createBaseX509Certificate() {
    return { rawBytes: Buffer.alloc(0) };
}
exports.X509Certificate = {
    fromJSON(object) {
        return { rawBytes: isSet(object.rawBytes) ? Buffer.from(bytesFromBase64(object.rawBytes)) : Buffer.alloc(0) };
    },
    toJSON(message) {
        const obj = {};
        message.rawBytes !== undefined &&
            (obj.rawBytes = base64FromBytes(message.rawBytes !== undefined ? message.rawBytes : Buffer.alloc(0)));
        return obj;
    },
};
function createBaseSubjectAlternativeName() {
    return { type: 0, identity: undefined };
}
exports.SubjectAlternativeName = {
    fromJSON(object) {
        return {
            type: isSet(object.type) ? subjectAlternativeNameTypeFromJSON(object.type) : 0,
            identity: isSet(object.regexp)
                ? { $case: "regexp", regexp: String(object.regexp) }
                : isSet(object.value)
                    ? { $case: "value", value: String(object.value) }
                    : undefined,
        };
    },
    toJSON(message) {
        const obj = {};
        message.type !== undefined && (obj.type = subjectAlternativeNameTypeToJSON(message.type));
        message.identity?.$case === "regexp" && (obj.regexp = message.identity?.regexp);
        message.identity?.$case === "value" && (obj.value = message.identity?.value);
        return obj;
    },
};
function createBaseX509CertificateChain() {
    return { certificates: [] };
}
exports.X509CertificateChain = {
    fromJSON(object) {
        return {
            certificates: Array.isArray(object?.certificates)
                ? object.certificates.map((e) => exports.X509Certificate.fromJSON(e))
                : [],
        };
    },
    toJSON(message) {
        const obj = {};
        if (message.certificates) {
            obj.certificates = message.certificates.map((e) => e ? exports.X509Certificate.toJSON(e) : undefined);
        }
        else {
            obj.certificates = [];
        }
        return obj;
    },
};
function createBaseTimeRange() {
    return { start: undefined, end: undefined };
}
exports.TimeRange = {
    fromJSON(object) {
        return {
            start: isSet(object.start) ? fromJsonTimestamp(object.start) : undefined,
            end: isSet(object.end) ? fromJsonTimestamp(object.end) : undefined,
        };
    },
    toJSON(message) {
        const obj = {};
        message.start !== undefined && (obj.start = message.start.toISOString());
        message.end !== undefined && (obj.end = message.end.toISOString());
        return obj;
    },
};
var tsProtoGlobalThis = (() => {
    if (typeof globalThis !== "undefined") {
        return globalThis;
    }
    if (typeof self !== "undefined") {
        return self;
    }
    if (typeof window !== "undefined") {
        return window;
    }
    if (typeof global !== "undefined") {
        return global;
    }
    throw "Unable to locate global object";
})();
function bytesFromBase64(b64) {
    if (tsProtoGlobalThis.Buffer) {
        return Uint8Array.from(tsProtoGlobalThis.Buffer.from(b64, "base64"));
    }
    else {
        const bin = tsProtoGlobalThis.atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; ++i) {
            arr[i] = bin.charCodeAt(i);
        }
        return arr;
    }
}
function base64FromBytes(arr) {
    if (tsProtoGlobalThis.Buffer) {
        return tsProtoGlobalThis.Buffer.from(arr).toString("base64");
    }
    else {
        const bin = [];
        arr.forEach((byte) => {
            bin.push(String.fromCharCode(byte));
        });
        return tsProtoGlobalThis.btoa(bin.join(""));
    }
}
function fromTimestamp(t) {
    let millis = Number(t.seconds) * 1000;
    millis += t.nanos / 1000000;
    return new Date(millis);
}
function fromJsonTimestamp(o) {
    if (o instanceof Date) {
        return o;
    }
    else if (typeof o === "string") {
        return new Date(o);
    }
    else {
        return fromTimestamp(timestamp_1.Timestamp.fromJSON(o));
    }
}
function isSet(value) {
    return value !== null && value !== undefined;
}


/***/ }),

/***/ 85204:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TransparencyLogEntry = exports.InclusionPromise = exports.InclusionProof = exports.Checkpoint = exports.KindVersion = void 0;
/* eslint-disable */
const sigstore_common_1 = __nccwpck_require__(5334);
function createBaseKindVersion() {
    return { kind: "", version: "" };
}
exports.KindVersion = {
    fromJSON(object) {
        return {
            kind: isSet(object.kind) ? String(object.kind) : "",
            version: isSet(object.version) ? String(object.version) : "",
        };
    },
    toJSON(message) {
        const obj = {};
        message.kind !== undefined && (obj.kind = message.kind);
        message.version !== undefined && (obj.version = message.version);
        return obj;
    },
};
function createBaseCheckpoint() {
    return { envelope: "" };
}
exports.Checkpoint = {
    fromJSON(object) {
        return { envelope: isSet(object.envelope) ? String(object.envelope) : "" };
    },
    toJSON(message) {
        const obj = {};
        message.envelope !== undefined && (obj.envelope = message.envelope);
        return obj;
    },
};
function createBaseInclusionProof() {
    return { logIndex: "0", rootHash: Buffer.alloc(0), treeSize: "0", hashes: [], checkpoint: undefined };
}
exports.InclusionProof = {
    fromJSON(object) {
        return {
            logIndex: isSet(object.logIndex) ? String(object.logIndex) : "0",
            rootHash: isSet(object.rootHash) ? Buffer.from(bytesFromBase64(object.rootHash)) : Buffer.alloc(0),
            treeSize: isSet(object.treeSize) ? String(object.treeSize) : "0",
            hashes: Array.isArray(object?.hashes) ? object.hashes.map((e) => Buffer.from(bytesFromBase64(e))) : [],
            checkpoint: isSet(object.checkpoint) ? exports.Checkpoint.fromJSON(object.checkpoint) : undefined,
        };
    },
    toJSON(message) {
        const obj = {};
        message.logIndex !== undefined && (obj.logIndex = message.logIndex);
        message.rootHash !== undefined &&
            (obj.rootHash = base64FromBytes(message.rootHash !== undefined ? message.rootHash : Buffer.alloc(0)));
        message.treeSize !== undefined && (obj.treeSize = message.treeSize);
        if (message.hashes) {
            obj.hashes = message.hashes.map((e) => base64FromBytes(e !== undefined ? e : Buffer.alloc(0)));
        }
        else {
            obj.hashes = [];
        }
        message.checkpoint !== undefined &&
            (obj.checkpoint = message.checkpoint ? exports.Checkpoint.toJSON(message.checkpoint) : undefined);
        return obj;
    },
};
function createBaseInclusionPromise() {
    return { signedEntryTimestamp: Buffer.alloc(0) };
}
exports.InclusionPromise = {
    fromJSON(object) {
        return {
            signedEntryTimestamp: isSet(object.signedEntryTimestamp)
                ? Buffer.from(bytesFromBase64(object.signedEntryTimestamp))
                : Buffer.alloc(0),
        };
    },
    toJSON(message) {
        const obj = {};
        message.signedEntryTimestamp !== undefined &&
            (obj.signedEntryTimestamp = base64FromBytes(message.signedEntryTimestamp !== undefined ? message.signedEntryTimestamp : Buffer.alloc(0)));
        return obj;
    },
};
function createBaseTransparencyLogEntry() {
    return {
        logIndex: "0",
        logId: undefined,
        kindVersion: undefined,
        integratedTime: "0",
        inclusionPromise: undefined,
        inclusionProof: undefined,
        canonicalizedBody: Buffer.alloc(0),
    };
}
exports.TransparencyLogEntry = {
    fromJSON(object) {
        return {
            logIndex: isSet(object.logIndex) ? String(object.logIndex) : "0",
            logId: isSet(object.logId) ? sigstore_common_1.LogId.fromJSON(object.logId) : undefined,
            kindVersion: isSet(object.kindVersion) ? exports.KindVersion.fromJSON(object.kindVersion) : undefined,
            integratedTime: isSet(object.integratedTime) ? String(object.integratedTime) : "0",
            inclusionPromise: isSet(object.inclusionPromise) ? exports.InclusionPromise.fromJSON(object.inclusionPromise) : undefined,
            inclusionProof: isSet(object.inclusionProof) ? exports.InclusionProof.fromJSON(object.inclusionProof) : undefined,
            canonicalizedBody: isSet(object.canonicalizedBody)
                ? Buffer.from(bytesFromBase64(object.canonicalizedBody))
                : Buffer.alloc(0),
        };
    },
    toJSON(message) {
        const obj = {};
        message.logIndex !== undefined && (obj.logIndex = message.logIndex);
        message.logId !== undefined && (obj.logId = message.logId ? sigstore_common_1.LogId.toJSON(message.logId) : undefined);
        message.kindVersion !== undefined &&
            (obj.kindVersion = message.kindVersion ? exports.KindVersion.toJSON(message.kindVersion) : undefined);
        message.integratedTime !== undefined && (obj.integratedTime = message.integratedTime);
        message.inclusionPromise !== undefined &&
            (obj.inclusionPromise = message.inclusionPromise ? exports.InclusionPromise.toJSON(message.inclusionPromise) : undefined);
        message.inclusionProof !== undefined &&
            (obj.inclusionProof = message.inclusionProof ? exports.InclusionProof.toJSON(message.inclusionProof) : undefined);
        message.canonicalizedBody !== undefined &&
            (obj.canonicalizedBody = base64FromBytes(message.canonicalizedBody !== undefined ? message.canonicalizedBody : Buffer.alloc(0)));
        return obj;
    },
};
var tsProtoGlobalThis = (() => {
    if (typeof globalThis !== "undefined") {
        return globalThis;
    }
    if (typeof self !== "undefined") {
        return self;
    }
    if (typeof window !== "undefined") {
        return window;
    }
    if (typeof global !== "undefined") {
        return global;
    }
    throw "Unable to locate global object";
})();
function bytesFromBase64(b64) {
    if (tsProtoGlobalThis.Buffer) {
        return Uint8Array.from(tsProtoGlobalThis.Buffer.from(b64, "base64"));
    }
    else {
        const bin = tsProtoGlobalThis.atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; ++i) {
            arr[i] = bin.charCodeAt(i);
        }
        return arr;
    }
}
function base64FromBytes(arr) {
    if (tsProtoGlobalThis.Buffer) {
        return tsProtoGlobalThis.Buffer.from(arr).toString("base64");
    }
    else {
        const bin = [];
        arr.forEach((byte) => {
            bin.push(String.fromCharCode(byte));
        });
        return tsProtoGlobalThis.btoa(bin.join(""));
    }
}
function isSet(value) {
    return value !== null && value !== undefined;
}


/***/ }),

/***/ 61997:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ClientTrustConfig = exports.SigningConfig = exports.TrustedRoot = exports.CertificateAuthority = exports.TransparencyLogInstance = void 0;
/* eslint-disable */
const sigstore_common_1 = __nccwpck_require__(5334);
function createBaseTransparencyLogInstance() {
    return { baseUrl: "", hashAlgorithm: 0, publicKey: undefined, logId: undefined, checkpointKeyId: undefined };
}
exports.TransparencyLogInstance = {
    fromJSON(object) {
        return {
            baseUrl: isSet(object.baseUrl) ? String(object.baseUrl) : "",
            hashAlgorithm: isSet(object.hashAlgorithm) ? (0, sigstore_common_1.hashAlgorithmFromJSON)(object.hashAlgorithm) : 0,
            publicKey: isSet(object.publicKey) ? sigstore_common_1.PublicKey.fromJSON(object.publicKey) : undefined,
            logId: isSet(object.logId) ? sigstore_common_1.LogId.fromJSON(object.logId) : undefined,
            checkpointKeyId: isSet(object.checkpointKeyId) ? sigstore_common_1.LogId.fromJSON(object.checkpointKeyId) : undefined,
        };
    },
    toJSON(message) {
        const obj = {};
        message.baseUrl !== undefined && (obj.baseUrl = message.baseUrl);
        message.hashAlgorithm !== undefined && (obj.hashAlgorithm = (0, sigstore_common_1.hashAlgorithmToJSON)(message.hashAlgorithm));
        message.publicKey !== undefined &&
            (obj.publicKey = message.publicKey ? sigstore_common_1.PublicKey.toJSON(message.publicKey) : undefined);
        message.logId !== undefined && (obj.logId = message.logId ? sigstore_common_1.LogId.toJSON(message.logId) : undefined);
        message.checkpointKeyId !== undefined &&
            (obj.checkpointKeyId = message.checkpointKeyId ? sigstore_common_1.LogId.toJSON(message.checkpointKeyId) : undefined);
        return obj;
    },
};
function createBaseCertificateAuthority() {
    return { subject: undefined, uri: "", certChain: undefined, validFor: undefined };
}
exports.CertificateAuthority = {
    fromJSON(object) {
        return {
            subject: isSet(object.subject) ? sigstore_common_1.DistinguishedName.fromJSON(object.subject) : undefined,
            uri: isSet(object.uri) ? String(object.uri) : "",
            certChain: isSet(object.certChain) ? sigstore_common_1.X509CertificateChain.fromJSON(object.certChain) : undefined,
            validFor: isSet(object.validFor) ? sigstore_common_1.TimeRange.fromJSON(object.validFor) : undefined,
        };
    },
    toJSON(message) {
        const obj = {};
        message.subject !== undefined &&
            (obj.subject = message.subject ? sigstore_common_1.DistinguishedName.toJSON(message.subject) : undefined);
        message.uri !== undefined && (obj.uri = message.uri);
        message.certChain !== undefined &&
            (obj.certChain = message.certChain ? sigstore_common_1.X509CertificateChain.toJSON(message.certChain) : undefined);
        message.validFor !== undefined &&
            (obj.validFor = message.validFor ? sigstore_common_1.TimeRange.toJSON(message.validFor) : undefined);
        return obj;
    },
};
function createBaseTrustedRoot() {
    return { mediaType: "", tlogs: [], certificateAuthorities: [], ctlogs: [], timestampAuthorities: [] };
}
exports.TrustedRoot = {
    fromJSON(object) {
        return {
            mediaType: isSet(object.mediaType) ? String(object.mediaType) : "",
            tlogs: Array.isArray(object?.tlogs) ? object.tlogs.map((e) => exports.TransparencyLogInstance.fromJSON(e)) : [],
            certificateAuthorities: Array.isArray(object?.certificateAuthorities)
                ? object.certificateAuthorities.map((e) => exports.CertificateAuthority.fromJSON(e))
                : [],
            ctlogs: Array.isArray(object?.ctlogs)
                ? object.ctlogs.map((e) => exports.TransparencyLogInstance.fromJSON(e))
                : [],
            timestampAuthorities: Array.isArray(object?.timestampAuthorities)
                ? object.timestampAuthorities.map((e) => exports.CertificateAuthority.fromJSON(e))
                : [],
        };
    },
    toJSON(message) {
        const obj = {};
        message.mediaType !== undefined && (obj.mediaType = message.mediaType);
        if (message.tlogs) {
            obj.tlogs = message.tlogs.map((e) => e ? exports.TransparencyLogInstance.toJSON(e) : undefined);
        }
        else {
            obj.tlogs = [];
        }
        if (message.certificateAuthorities) {
            obj.certificateAuthorities = message.certificateAuthorities.map((e) => e ? exports.CertificateAuthority.toJSON(e) : undefined);
        }
        else {
            obj.certificateAuthorities = [];
        }
        if (message.ctlogs) {
            obj.ctlogs = message.ctlogs.map((e) => e ? exports.TransparencyLogInstance.toJSON(e) : undefined);
        }
        else {
            obj.ctlogs = [];
        }
        if (message.timestampAuthorities) {
            obj.timestampAuthorities = message.timestampAuthorities.map((e) => e ? exports.CertificateAuthority.toJSON(e) : undefined);
        }
        else {
            obj.timestampAuthorities = [];
        }
        return obj;
    },
};
function createBaseSigningConfig() {
    return { caUrl: "", oidcUrl: "", tlogUrls: [], tsaUrls: [] };
}
exports.SigningConfig = {
    fromJSON(object) {
        return {
            caUrl: isSet(object.caUrl) ? String(object.caUrl) : "",
            oidcUrl: isSet(object.oidcUrl) ? String(object.oidcUrl) : "",
            tlogUrls: Array.isArray(object?.tlogUrls) ? object.tlogUrls.map((e) => String(e)) : [],
            tsaUrls: Array.isArray(object?.tsaUrls) ? object.tsaUrls.map((e) => String(e)) : [],
        };
    },
    toJSON(message) {
        const obj = {};
        message.caUrl !== undefined && (obj.caUrl = message.caUrl);
        message.oidcUrl !== undefined && (obj.oidcUrl = message.oidcUrl);
        if (message.tlogUrls) {
            obj.tlogUrls = message.tlogUrls.map((e) => e);
        }
        else {
            obj.tlogUrls = [];
        }
        if (message.tsaUrls) {
            obj.tsaUrls = message.tsaUrls.map((e) => e);
        }
        else {
            obj.tsaUrls = [];
        }
        return obj;
    },
};
function createBaseClientTrustConfig() {
    return { mediaType: "", trustedRoot: undefined, signingConfig: undefined };
}
exports.ClientTrustConfig = {
    fromJSON(object) {
        return {
            mediaType: isSet(object.mediaType) ? String(object.mediaType) : "",
            trustedRoot: isSet(object.trustedRoot) ? exports.TrustedRoot.fromJSON(object.trustedRoot) : undefined,
            signingConfig: isSet(object.signingConfig) ? exports.SigningConfig.fromJSON(object.signingConfig) : undefined,
        };
    },
    toJSON(message) {
        const obj = {};
        message.mediaType !== undefined && (obj.mediaType = message.mediaType);
        message.trustedRoot !== undefined &&
            (obj.trustedRoot = message.trustedRoot ? exports.TrustedRoot.toJSON(message.trustedRoot) : undefined);
        message.signingConfig !== undefined &&
            (obj.signingConfig = message.signingConfig ? exports.SigningConfig.toJSON(message.signingConfig) : undefined);
        return obj;
    },
};
function isSet(value) {
    return value !== null && value !== undefined;
}


/***/ }),

/***/ 99732:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Input = exports.Artifact = exports.ArtifactVerificationOptions_ObserverTimestampOptions = exports.ArtifactVerificationOptions_TlogIntegratedTimestampOptions = exports.ArtifactVerificationOptions_TimestampAuthorityOptions = exports.ArtifactVerificationOptions_CtlogOptions = exports.ArtifactVerificationOptions_TlogOptions = exports.ArtifactVerificationOptions = exports.PublicKeyIdentities = exports.CertificateIdentities = exports.CertificateIdentity = void 0;
/* eslint-disable */
const sigstore_bundle_1 = __nccwpck_require__(70715);
const sigstore_common_1 = __nccwpck_require__(5334);
const sigstore_trustroot_1 = __nccwpck_require__(61997);
function createBaseCertificateIdentity() {
    return { issuer: "", san: undefined, oids: [] };
}
exports.CertificateIdentity = {
    fromJSON(object) {
        return {
            issuer: isSet(object.issuer) ? String(object.issuer) : "",
            san: isSet(object.san) ? sigstore_common_1.SubjectAlternativeName.fromJSON(object.san) : undefined,
            oids: Array.isArray(object?.oids) ? object.oids.map((e) => sigstore_common_1.ObjectIdentifierValuePair.fromJSON(e)) : [],
        };
    },
    toJSON(message) {
        const obj = {};
        message.issuer !== undefined && (obj.issuer = message.issuer);
        message.san !== undefined && (obj.san = message.san ? sigstore_common_1.SubjectAlternativeName.toJSON(message.san) : undefined);
        if (message.oids) {
            obj.oids = message.oids.map((e) => e ? sigstore_common_1.ObjectIdentifierValuePair.toJSON(e) : undefined);
        }
        else {
            obj.oids = [];
        }
        return obj;
    },
};
function createBaseCertificateIdentities() {
    return { identities: [] };
}
exports.CertificateIdentities = {
    fromJSON(object) {
        return {
            identities: Array.isArray(object?.identities)
                ? object.identities.map((e) => exports.CertificateIdentity.fromJSON(e))
                : [],
        };
    },
    toJSON(message) {
        const obj = {};
        if (message.identities) {
            obj.identities = message.identities.map((e) => e ? exports.CertificateIdentity.toJSON(e) : undefined);
        }
        else {
            obj.identities = [];
        }
        return obj;
    },
};
function createBasePublicKeyIdentities() {
    return { publicKeys: [] };
}
exports.PublicKeyIdentities = {
    fromJSON(object) {
        return {
            publicKeys: Array.isArray(object?.publicKeys) ? object.publicKeys.map((e) => sigstore_common_1.PublicKey.fromJSON(e)) : [],
        };
    },
    toJSON(message) {
        const obj = {};
        if (message.publicKeys) {
            obj.publicKeys = message.publicKeys.map((e) => e ? sigstore_common_1.PublicKey.toJSON(e) : undefined);
        }
        else {
            obj.publicKeys = [];
        }
        return obj;
    },
};
function createBaseArtifactVerificationOptions() {
    return {
        signers: undefined,
        tlogOptions: undefined,
        ctlogOptions: undefined,
        tsaOptions: undefined,
        integratedTsOptions: undefined,
        observerOptions: undefined,
    };
}
exports.ArtifactVerificationOptions = {
    fromJSON(object) {
        return {
            signers: isSet(object.certificateIdentities)
                ? {
                    $case: "certificateIdentities",
                    certificateIdentities: exports.CertificateIdentities.fromJSON(object.certificateIdentities),
                }
                : isSet(object.publicKeys)
                    ? { $case: "publicKeys", publicKeys: exports.PublicKeyIdentities.fromJSON(object.publicKeys) }
                    : undefined,
            tlogOptions: isSet(object.tlogOptions)
                ? exports.ArtifactVerificationOptions_TlogOptions.fromJSON(object.tlogOptions)
                : undefined,
            ctlogOptions: isSet(object.ctlogOptions)
                ? exports.ArtifactVerificationOptions_CtlogOptions.fromJSON(object.ctlogOptions)
                : undefined,
            tsaOptions: isSet(object.tsaOptions)
                ? exports.ArtifactVerificationOptions_TimestampAuthorityOptions.fromJSON(object.tsaOptions)
                : undefined,
            integratedTsOptions: isSet(object.integratedTsOptions)
                ? exports.ArtifactVerificationOptions_TlogIntegratedTimestampOptions.fromJSON(object.integratedTsOptions)
                : undefined,
            observerOptions: isSet(object.observerOptions)
                ? exports.ArtifactVerificationOptions_ObserverTimestampOptions.fromJSON(object.observerOptions)
                : undefined,
        };
    },
    toJSON(message) {
        const obj = {};
        message.signers?.$case === "certificateIdentities" &&
            (obj.certificateIdentities = message.signers?.certificateIdentities
                ? exports.CertificateIdentities.toJSON(message.signers?.certificateIdentities)
                : undefined);
        message.signers?.$case === "publicKeys" && (obj.publicKeys = message.signers?.publicKeys
            ? exports.PublicKeyIdentities.toJSON(message.signers?.publicKeys)
            : undefined);
        message.tlogOptions !== undefined && (obj.tlogOptions = message.tlogOptions
            ? exports.ArtifactVerificationOptions_TlogOptions.toJSON(message.tlogOptions)
            : undefined);
        message.ctlogOptions !== undefined && (obj.ctlogOptions = message.ctlogOptions
            ? exports.ArtifactVerificationOptions_CtlogOptions.toJSON(message.ctlogOptions)
            : undefined);
        message.tsaOptions !== undefined && (obj.tsaOptions = message.tsaOptions
            ? exports.ArtifactVerificationOptions_TimestampAuthorityOptions.toJSON(message.tsaOptions)
            : undefined);
        message.integratedTsOptions !== undefined && (obj.integratedTsOptions = message.integratedTsOptions
            ? exports.ArtifactVerificationOptions_TlogIntegratedTimestampOptions.toJSON(message.integratedTsOptions)
            : undefined);
        message.observerOptions !== undefined && (obj.observerOptions = message.observerOptions
            ? exports.ArtifactVerificationOptions_ObserverTimestampOptions.toJSON(message.observerOptions)
            : undefined);
        return obj;
    },
};
function createBaseArtifactVerificationOptions_TlogOptions() {
    return { threshold: 0, performOnlineVerification: false, disable: false };
}
exports.ArtifactVerificationOptions_TlogOptions = {
    fromJSON(object) {
        return {
            threshold: isSet(object.threshold) ? Number(object.threshold) : 0,
            performOnlineVerification: isSet(object.performOnlineVerification)
                ? Boolean(object.performOnlineVerification)
                : false,
            disable: isSet(object.disable) ? Boolean(object.disable) : false,
        };
    },
    toJSON(message) {
        const obj = {};
        message.threshold !== undefined && (obj.threshold = Math.round(message.threshold));
        message.performOnlineVerification !== undefined &&
            (obj.performOnlineVerification = message.performOnlineVerification);
        message.disable !== undefined && (obj.disable = message.disable);
        return obj;
    },
};
function createBaseArtifactVerificationOptions_CtlogOptions() {
    return { threshold: 0, disable: false };
}
exports.ArtifactVerificationOptions_CtlogOptions = {
    fromJSON(object) {
        return {
            threshold: isSet(object.threshold) ? Number(object.threshold) : 0,
            disable: isSet(object.disable) ? Boolean(object.disable) : false,
        };
    },
    toJSON(message) {
        const obj = {};
        message.threshold !== undefined && (obj.threshold = Math.round(message.threshold));
        message.disable !== undefined && (obj.disable = message.disable);
        return obj;
    },
};
function createBaseArtifactVerificationOptions_TimestampAuthorityOptions() {
    return { threshold: 0, disable: false };
}
exports.ArtifactVerificationOptions_TimestampAuthorityOptions = {
    fromJSON(object) {
        return {
            threshold: isSet(object.threshold) ? Number(object.threshold) : 0,
            disable: isSet(object.disable) ? Boolean(object.disable) : false,
        };
    },
    toJSON(message) {
        const obj = {};
        message.threshold !== undefined && (obj.threshold = Math.round(message.threshold));
        message.disable !== undefined && (obj.disable = message.disable);
        return obj;
    },
};
function createBaseArtifactVerificationOptions_TlogIntegratedTimestampOptions() {
    return { threshold: 0, disable: false };
}
exports.ArtifactVerificationOptions_TlogIntegratedTimestampOptions = {
    fromJSON(object) {
        return {
            threshold: isSet(object.threshold) ? Number(object.threshold) : 0,
            disable: isSet(object.disable) ? Boolean(object.disable) : false,
        };
    },
    toJSON(message) {
        const obj = {};
        message.threshold !== undefined && (obj.threshold = Math.round(message.threshold));
        message.disable !== undefined && (obj.disable = message.disable);
        return obj;
    },
};
function createBaseArtifactVerificationOptions_ObserverTimestampOptions() {
    return { threshold: 0, disable: false };
}
exports.ArtifactVerificationOptions_ObserverTimestampOptions = {
    fromJSON(object) {
        return {
            threshold: isSet(object.threshold) ? Number(object.threshold) : 0,
            disable: isSet(object.disable) ? Boolean(object.disable) : false,
        };
    },
    toJSON(message) {
        const obj = {};
        message.threshold !== undefined && (obj.threshold = Math.round(message.threshold));
        message.disable !== undefined && (obj.disable = message.disable);
        return obj;
    },
};
function createBaseArtifact() {
    return { data: undefined };
}
exports.Artifact = {
    fromJSON(object) {
        return {
            data: isSet(object.artifactUri)
                ? { $case: "artifactUri", artifactUri: String(object.artifactUri) }
                : isSet(object.artifact)
                    ? { $case: "artifact", artifact: Buffer.from(bytesFromBase64(object.artifact)) }
                    : undefined,
        };
    },
    toJSON(message) {
        const obj = {};
        message.data?.$case === "artifactUri" && (obj.artifactUri = message.data?.artifactUri);
        message.data?.$case === "artifact" &&
            (obj.artifact = message.data?.artifact !== undefined ? base64FromBytes(message.data?.artifact) : undefined);
        return obj;
    },
};
function createBaseInput() {
    return {
        artifactTrustRoot: undefined,
        artifactVerificationOptions: undefined,
        bundle: undefined,
        artifact: undefined,
    };
}
exports.Input = {
    fromJSON(object) {
        return {
            artifactTrustRoot: isSet(object.artifactTrustRoot) ? sigstore_trustroot_1.TrustedRoot.fromJSON(object.artifactTrustRoot) : undefined,
            artifactVerificationOptions: isSet(object.artifactVerificationOptions)
                ? exports.ArtifactVerificationOptions.fromJSON(object.artifactVerificationOptions)
                : undefined,
            bundle: isSet(object.bundle) ? sigstore_bundle_1.Bundle.fromJSON(object.bundle) : undefined,
            artifact: isSet(object.artifact) ? exports.Artifact.fromJSON(object.artifact) : undefined,
        };
    },
    toJSON(message) {
        const obj = {};
        message.artifactTrustRoot !== undefined &&
            (obj.artifactTrustRoot = message.artifactTrustRoot ? sigstore_trustroot_1.TrustedRoot.toJSON(message.artifactTrustRoot) : undefined);
        message.artifactVerificationOptions !== undefined &&
            (obj.artifactVerificationOptions = message.artifactVerificationOptions
                ? exports.ArtifactVerificationOptions.toJSON(message.artifactVerificationOptions)
                : undefined);
        message.bundle !== undefined && (obj.bundle = message.bundle ? sigstore_bundle_1.Bundle.toJSON(message.bundle) : undefined);
        message.artifact !== undefined && (obj.artifact = message.artifact ? exports.Artifact.toJSON(message.artifact) : undefined);
        return obj;
    },
};
var tsProtoGlobalThis = (() => {
    if (typeof globalThis !== "undefined") {
        return globalThis;
    }
    if (typeof self !== "undefined") {
        return self;
    }
    if (typeof window !== "undefined") {
        return window;
    }
    if (typeof global !== "undefined") {
        return global;
    }
    throw "Unable to locate global object";
})();
function bytesFromBase64(b64) {
    if (tsProtoGlobalThis.Buffer) {
        return Uint8Array.from(tsProtoGlobalThis.Buffer.from(b64, "base64"));
    }
    else {
        const bin = tsProtoGlobalThis.atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; ++i) {
            arr[i] = bin.charCodeAt(i);
        }
        return arr;
    }
}
function base64FromBytes(arr) {
    if (tsProtoGlobalThis.Buffer) {
        return tsProtoGlobalThis.Buffer.from(arr).toString("base64");
    }
    else {
        const bin = [];
        arr.forEach((byte) => {
            bin.push(String.fromCharCode(byte));
        });
        return tsProtoGlobalThis.btoa(bin.join(""));
    }
}
function isSet(value) {
    return value !== null && value !== undefined;
}


/***/ }),

/***/ 19654:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
__exportStar(__nccwpck_require__(47030), exports);
__exportStar(__nccwpck_require__(70715), exports);
__exportStar(__nccwpck_require__(5334), exports);
__exportStar(__nccwpck_require__(85204), exports);
__exportStar(__nccwpck_require__(61997), exports);
__exportStar(__nccwpck_require__(99732), exports);


/***/ }),

/***/ 43049:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BaseBundleBuilder = void 0;
// BaseBundleBuilder is a base class for BundleBuilder implementations. It
// provides a the basic wokflow for signing and witnessing an artifact.
// Subclasses must implement the `package` method to assemble a valid bundle
// with the generated signature and verification material.
class BaseBundleBuilder {
    constructor(options) {
        this.signer = options.signer;
        this.witnesses = options.witnesses;
    }
    // Executes the signing/witnessing process for the given artifact.
    async create(artifact) {
        const signature = await this.prepare(artifact).then((blob) => this.signer.sign(blob));
        const bundle = await this.package(artifact, signature);
        // Invoke all of the witnesses in parallel
        const verificationMaterials = await Promise.all(this.witnesses.map((witness) => witness.testify(bundle.content, publicKey(signature.key))));
        // Collect the verification material from all of the witnesses
        const tlogEntryList = [];
        const timestampList = [];
        verificationMaterials.forEach(({ tlogEntries, rfc3161Timestamps }) => {
            tlogEntryList.push(...(tlogEntries ?? []));
            timestampList.push(...(rfc3161Timestamps ?? []));
        });
        // Merge the collected verification material into the bundle
        bundle.verificationMaterial.tlogEntries = tlogEntryList;
        bundle.verificationMaterial.timestampVerificationData = {
            rfc3161Timestamps: timestampList,
        };
        return bundle;
    }
    // Override this function to apply any pre-signing transformations to the
    // artifact. The returned buffer will be signed by the signer. The default
    // implementation simply returns the artifact data.
    async prepare(artifact) {
        return artifact.data;
    }
}
exports.BaseBundleBuilder = BaseBundleBuilder;
// Extracts the public key from a KeyMaterial. Returns either the public key
// or the certificate, depending on the type of key material.
function publicKey(key) {
    switch (key.$case) {
        case 'publicKey':
            return key.publicKey;
        case 'x509Certificate':
            return key.certificate;
    }
}


/***/ }),

/***/ 85192:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.toMessageSignatureBundle = toMessageSignatureBundle;
exports.toDSSEBundle = toDSSEBundle;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const sigstore = __importStar(__nccwpck_require__(61040));
const util_1 = __nccwpck_require__(19100);
// Helper functions for assembling the parts of a Sigstore bundle
// Message signature bundle - $case: 'messageSignature'
function toMessageSignatureBundle(artifact, signature) {
    const digest = util_1.crypto.digest('sha256', artifact.data);
    return sigstore.toMessageSignatureBundle({
        digest,
        signature: signature.signature,
        certificate: signature.key.$case === 'x509Certificate'
            ? util_1.pem.toDER(signature.key.certificate)
            : undefined,
        keyHint: signature.key.$case === 'publicKey' ? signature.key.hint : undefined,
        certificateChain: true,
    });
}
// DSSE envelope bundle - $case: 'dsseEnvelope'
function toDSSEBundle(artifact, signature, certificateChain) {
    return sigstore.toDSSEBundle({
        artifact: artifact.data,
        artifactType: artifact.type,
        signature: signature.signature,
        certificate: signature.key.$case === 'x509Certificate'
            ? util_1.pem.toDER(signature.key.certificate)
            : undefined,
        keyHint: signature.key.$case === 'publicKey' ? signature.key.hint : undefined,
        certificateChain,
    });
}


/***/ }),

/***/ 83997:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DSSEBundleBuilder = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const util_1 = __nccwpck_require__(19100);
const base_1 = __nccwpck_require__(43049);
const bundle_1 = __nccwpck_require__(85192);
// BundleBuilder implementation for DSSE wrapped attestations
class DSSEBundleBuilder extends base_1.BaseBundleBuilder {
    constructor(options) {
        super(options);
        this.certificateChain = options.certificateChain ?? false;
    }
    // DSSE requires the artifact to be pre-encoded with the payload type
    // before the signature is generated.
    async prepare(artifact) {
        const a = artifactDefaults(artifact);
        return util_1.dsse.preAuthEncoding(a.type, a.data);
    }
    // Packages the artifact and signature into a DSSE bundle
    async package(artifact, signature) {
        return (0, bundle_1.toDSSEBundle)(artifactDefaults(artifact), signature, this.certificateChain);
    }
}
exports.DSSEBundleBuilder = DSSEBundleBuilder;
// Defaults the artifact type to an empty string if not provided
function artifactDefaults(artifact) {
    return {
        ...artifact,
        type: artifact.type ?? '',
    };
}


/***/ }),

/***/ 35530:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MessageSignatureBundleBuilder = exports.DSSEBundleBuilder = void 0;
var dsse_1 = __nccwpck_require__(83997);
Object.defineProperty(exports, "DSSEBundleBuilder", ({ enumerable: true, get: function () { return dsse_1.DSSEBundleBuilder; } }));
var message_1 = __nccwpck_require__(8269);
Object.defineProperty(exports, "MessageSignatureBundleBuilder", ({ enumerable: true, get: function () { return message_1.MessageSignatureBundleBuilder; } }));


/***/ }),

/***/ 8269:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MessageSignatureBundleBuilder = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const base_1 = __nccwpck_require__(43049);
const bundle_1 = __nccwpck_require__(85192);
// BundleBuilder implementation for raw message signatures
class MessageSignatureBundleBuilder extends base_1.BaseBundleBuilder {
    constructor(options) {
        super(options);
    }
    async package(artifact, signature) {
        return (0, bundle_1.toMessageSignatureBundle)(artifact, signature);
    }
}
exports.MessageSignatureBundleBuilder = MessageSignatureBundleBuilder;


/***/ }),

/***/ 97841:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.InternalError = void 0;
exports.internalError = internalError;
const error_1 = __nccwpck_require__(40369);
class InternalError extends Error {
    constructor({ code, message, cause, }) {
        super(message);
        this.name = this.constructor.name;
        this.cause = cause;
        this.code = code;
    }
}
exports.InternalError = InternalError;
function internalError(err, code, message) {
    if (err instanceof error_1.HTTPError) {
        message += ` - ${err.message}`;
    }
    throw new InternalError({
        code: code,
        message: message,
        cause: err,
    });
}


/***/ }),

/***/ 40369:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HTTPError = void 0;
class HTTPError extends Error {
    constructor({ status, message, location, }) {
        super(`(${status}) ${message}`);
        this.statusCode = status;
        this.location = location;
    }
}
exports.HTTPError = HTTPError;


/***/ }),

/***/ 9823:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fetchWithRetry = fetchWithRetry;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const http2_1 = __nccwpck_require__(85675);
const make_fetch_happen_1 = __importDefault(__nccwpck_require__(39310));
const proc_log_1 = __nccwpck_require__(26687);
const promise_retry_1 = __importDefault(__nccwpck_require__(90390));
const util_1 = __nccwpck_require__(19100);
const error_1 = __nccwpck_require__(40369);
const { HTTP2_HEADER_LOCATION, HTTP2_HEADER_CONTENT_TYPE, HTTP2_HEADER_USER_AGENT, HTTP_STATUS_INTERNAL_SERVER_ERROR, HTTP_STATUS_TOO_MANY_REQUESTS, HTTP_STATUS_REQUEST_TIMEOUT, } = http2_1.constants;
async function fetchWithRetry(url, options) {
    return (0, promise_retry_1.default)(async (retry, attemptNum) => {
        const method = options.method || 'POST';
        const headers = {
            [HTTP2_HEADER_USER_AGENT]: util_1.ua.getUserAgent(),
            ...options.headers,
        };
        const response = await (0, make_fetch_happen_1.default)(url, {
            method,
            headers,
            body: options.body,
            timeout: options.timeout,
            retry: false, // We're handling retries ourselves
        }).catch((reason) => {
            proc_log_1.log.http('fetch', `${method} ${url} attempt ${attemptNum} failed with ${reason}`);
            return retry(reason);
        });
        if (response.ok) {
            return response;
        }
        else {
            const error = await errorFromResponse(response);
            proc_log_1.log.http('fetch', `${method} ${url} attempt ${attemptNum} failed with ${response.status}`);
            if (retryable(response.status)) {
                return retry(error);
            }
            else {
                throw error;
            }
        }
    }, retryOpts(options.retry));
}
// Translate a Response into an HTTPError instance. This will attempt to parse
// the response body for a message, but will default to the statusText if none
// is found.
const errorFromResponse = async (response) => {
    let message = response.statusText;
    const location = response.headers.get(HTTP2_HEADER_LOCATION) || undefined;
    const contentType = response.headers.get(HTTP2_HEADER_CONTENT_TYPE);
    // If response type is JSON, try to parse the body for a message
    if (contentType?.includes('application/json')) {
        try {
            const body = await response.json();
            message = body.message || message;
        }
        catch (e) {
            // ignore
        }
    }
    return new error_1.HTTPError({
        status: response.status,
        message: message,
        location: location,
    });
};
// Determine if a status code is retryable. This includes 5xx errors, 408, and
// 429.
const retryable = (status) => [HTTP_STATUS_REQUEST_TIMEOUT, HTTP_STATUS_TOO_MANY_REQUESTS].includes(status) || status >= HTTP_STATUS_INTERNAL_SERVER_ERROR;
// Normalize the retry options to the format expected by promise-retry
const retryOpts = (retry) => {
    if (typeof retry === 'boolean') {
        return { retries: retry ? 1 : 0 };
    }
    else if (typeof retry === 'number') {
        return { retries: retry };
    }
    else {
        return { retries: 0, ...retry };
    }
};


/***/ }),

/***/ 26819:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Fulcio = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const fetch_1 = __nccwpck_require__(9823);
/**
 * Fulcio API client.
 */
class Fulcio {
    constructor(options) {
        this.options = options;
    }
    async createSigningCertificate(request) {
        const { baseURL, retry, timeout } = this.options;
        const url = `${baseURL}/api/v2/signingCert`;
        const response = await (0, fetch_1.fetchWithRetry)(url, {
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
            timeout,
            retry,
        });
        return response.json();
    }
}
exports.Fulcio = Fulcio;


/***/ }),

/***/ 32688:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Rekor = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const fetch_1 = __nccwpck_require__(9823);
/**
 * Rekor API client.
 */
class Rekor {
    constructor(options) {
        this.options = options;
    }
    /**
     * Create a new entry in the Rekor log.
     * @param propsedEntry {ProposedEntry} Data to create a new entry
     * @returns {Promise<Entry>} The created entry
     */
    async createEntry(propsedEntry) {
        const { baseURL, timeout, retry } = this.options;
        const url = `${baseURL}/api/v1/log/entries`;
        const response = await (0, fetch_1.fetchWithRetry)(url, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(propsedEntry),
            timeout,
            retry,
        });
        const data = await response.json();
        return entryFromResponse(data);
    }
    /**
     * Get an entry from the Rekor log.
     * @param uuid {string} The UUID of the entry to retrieve
     * @returns {Promise<Entry>} The retrieved entry
     */
    async getEntry(uuid) {
        const { baseURL, timeout, retry } = this.options;
        const url = `${baseURL}/api/v1/log/entries/${uuid}`;
        const response = await (0, fetch_1.fetchWithRetry)(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
            timeout,
            retry,
        });
        const data = await response.json();
        return entryFromResponse(data);
    }
}
exports.Rekor = Rekor;
// Unpack the response from the Rekor API into a more convenient format.
function entryFromResponse(data) {
    const entries = Object.entries(data);
    if (entries.length != 1) {
        throw new Error('Received multiple entries in Rekor response');
    }
    // Grab UUID and entry data from the response
    const [uuid, entry] = entries[0];
    return {
        ...entry,
        uuid,
    };
}


/***/ }),

/***/ 78963:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TimestampAuthority = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const fetch_1 = __nccwpck_require__(9823);
class TimestampAuthority {
    constructor(options) {
        this.options = options;
    }
    async createTimestamp(request) {
        const { baseURL, timeout, retry } = this.options;
        const url = `${baseURL}/api/v1/timestamp`;
        const response = await (0, fetch_1.fetchWithRetry)(url, {
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
            timeout,
            retry,
        });
        return response.buffer();
    }
}
exports.TimestampAuthority = TimestampAuthority;


/***/ }),

/***/ 92092:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CIContextProvider = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const make_fetch_happen_1 = __importDefault(__nccwpck_require__(39310));
// Collection of all the CI-specific providers we have implemented
const providers = [getGHAToken, getEnv];
/**
 * CIContextProvider is a composite identity provider which will iterate
 * over all of the CI-specific providers and return the token from the first
 * one that resolves.
 */
class CIContextProvider {
    /* istanbul ignore next */
    constructor(audience = 'sigstore') {
        this.audience = audience;
    }
    // Invoke all registered ProviderFuncs and return the value of whichever one
    // resolves first.
    async getToken() {
        return Promise.any(providers.map((getToken) => getToken(this.audience))).catch(() => Promise.reject('CI: no tokens available'));
    }
}
exports.CIContextProvider = CIContextProvider;
/**
 * getGHAToken can retrieve an OIDC token when running in a GitHub Actions
 * workflow
 */
async function getGHAToken(audience) {
    // Check to see if we're running in GitHub Actions
    if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL ||
        !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) {
        return Promise.reject('no token available');
    }
    // Construct URL to request token w/ appropriate audience
    const url = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
    url.searchParams.append('audience', audience);
    const response = await (0, make_fetch_happen_1.default)(url.href, {
        retry: 2,
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`,
        },
    });
    return response.json().then((data) => data.value);
}
/**
 * getEnv can retrieve an OIDC token from an environment variable.
 * This matches the behavior of https://github.com/sigstore/cosign/tree/main/pkg/providers/envvar
 */
async function getEnv() {
    if (!process.env.SIGSTORE_ID_TOKEN) {
        return Promise.reject('no token available');
    }
    return process.env.SIGSTORE_ID_TOKEN;
}


/***/ }),

/***/ 55022:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CIContextProvider = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
var ci_1 = __nccwpck_require__(92092);
Object.defineProperty(exports, "CIContextProvider", ({ enumerable: true, get: function () { return ci_1.CIContextProvider; } }));


/***/ }),

/***/ 15179:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TSAWitness = exports.RekorWitness = exports.DEFAULT_REKOR_URL = exports.FulcioSigner = exports.DEFAULT_FULCIO_URL = exports.CIContextProvider = exports.InternalError = exports.MessageSignatureBundleBuilder = exports.DSSEBundleBuilder = void 0;
var bundler_1 = __nccwpck_require__(35530);
Object.defineProperty(exports, "DSSEBundleBuilder", ({ enumerable: true, get: function () { return bundler_1.DSSEBundleBuilder; } }));
Object.defineProperty(exports, "MessageSignatureBundleBuilder", ({ enumerable: true, get: function () { return bundler_1.MessageSignatureBundleBuilder; } }));
var error_1 = __nccwpck_require__(97841);
Object.defineProperty(exports, "InternalError", ({ enumerable: true, get: function () { return error_1.InternalError; } }));
var identity_1 = __nccwpck_require__(55022);
Object.defineProperty(exports, "CIContextProvider", ({ enumerable: true, get: function () { return identity_1.CIContextProvider; } }));
var signer_1 = __nccwpck_require__(34342);
Object.defineProperty(exports, "DEFAULT_FULCIO_URL", ({ enumerable: true, get: function () { return signer_1.DEFAULT_FULCIO_URL; } }));
Object.defineProperty(exports, "FulcioSigner", ({ enumerable: true, get: function () { return signer_1.FulcioSigner; } }));
var witness_1 = __nccwpck_require__(55383);
Object.defineProperty(exports, "DEFAULT_REKOR_URL", ({ enumerable: true, get: function () { return witness_1.DEFAULT_REKOR_URL; } }));
Object.defineProperty(exports, "RekorWitness", ({ enumerable: true, get: function () { return witness_1.RekorWitness; } }));
Object.defineProperty(exports, "TSAWitness", ({ enumerable: true, get: function () { return witness_1.TSAWitness; } }));


/***/ }),

/***/ 5875:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CAClient = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const error_1 = __nccwpck_require__(97841);
const fulcio_1 = __nccwpck_require__(26819);
class CAClient {
    constructor(options) {
        this.fulcio = new fulcio_1.Fulcio({
            baseURL: options.fulcioBaseURL,
            retry: options.retry,
            timeout: options.timeout,
        });
    }
    async createSigningCertificate(identityToken, publicKey, challenge) {
        const request = toCertificateRequest(identityToken, publicKey, challenge);
        try {
            const resp = await this.fulcio.createSigningCertificate(request);
            // Account for the fact that the response may contain either a
            // signedCertificateEmbeddedSct or a signedCertificateDetachedSct.
            const cert = resp.signedCertificateEmbeddedSct
                ? resp.signedCertificateEmbeddedSct
                : resp.signedCertificateDetachedSct;
            return cert.chain.certificates;
        }
        catch (err) {
            (0, error_1.internalError)(err, 'CA_CREATE_SIGNING_CERTIFICATE_ERROR', 'error creating signing certificate');
        }
    }
}
exports.CAClient = CAClient;
function toCertificateRequest(identityToken, publicKey, challenge) {
    return {
        credentials: {
            oidcIdentityToken: identityToken,
        },
        publicKeyRequest: {
            publicKey: {
                algorithm: 'ECDSA',
                content: publicKey,
            },
            proofOfPossession: challenge.toString('base64'),
        },
    };
}


/***/ }),

/***/ 97064:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EphemeralSigner = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const crypto_1 = __importDefault(__nccwpck_require__(76982));
const EC_KEYPAIR_TYPE = 'ec';
const P256_CURVE = 'P-256';
// Signer implementation which uses an ephemeral keypair to sign artifacts.
// The private key lives only in memory and is tied to the lifetime of the
// EphemeralSigner instance.
class EphemeralSigner {
    constructor() {
        this.keypair = crypto_1.default.generateKeyPairSync(EC_KEYPAIR_TYPE, {
            namedCurve: P256_CURVE,
        });
    }
    async sign(data) {
        const signature = crypto_1.default.sign(null, data, this.keypair.privateKey);
        const publicKey = this.keypair.publicKey
            .export({ format: 'pem', type: 'spki' })
            .toString('ascii');
        return {
            signature: signature,
            key: { $case: 'publicKey', publicKey },
        };
    }
}
exports.EphemeralSigner = EphemeralSigner;


/***/ }),

/***/ 26303:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FulcioSigner = exports.DEFAULT_FULCIO_URL = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const error_1 = __nccwpck_require__(97841);
const util_1 = __nccwpck_require__(19100);
const ca_1 = __nccwpck_require__(5875);
const ephemeral_1 = __nccwpck_require__(97064);
exports.DEFAULT_FULCIO_URL = 'https://fulcio.sigstore.dev';
// Signer implementation which can be used to decorate another signer
// with a Fulcio-issued signing certificate for the signer's public key.
// Must be instantiated with an identity provider which can provide a JWT
// which represents the identity to be bound to the signing certificate.
class FulcioSigner {
    constructor(options) {
        this.ca = new ca_1.CAClient({
            ...options,
            fulcioBaseURL: options.fulcioBaseURL || /* istanbul ignore next */ exports.DEFAULT_FULCIO_URL,
        });
        this.identityProvider = options.identityProvider;
        this.keyHolder = options.keyHolder || new ephemeral_1.EphemeralSigner();
    }
    async sign(data) {
        // Retrieve identity token from the supplied identity provider
        const identityToken = await this.getIdentityToken();
        // Extract challenge claim from OIDC token
        let subject;
        try {
            subject = util_1.oidc.extractJWTSubject(identityToken);
        }
        catch (err) {
            throw new error_1.InternalError({
                code: 'IDENTITY_TOKEN_PARSE_ERROR',
                message: `invalid identity token: ${identityToken}`,
                cause: err,
            });
        }
        // Construct challenge value by signing the subject claim
        const challenge = await this.keyHolder.sign(Buffer.from(subject));
        if (challenge.key.$case !== 'publicKey') {
            throw new error_1.InternalError({
                code: 'CA_CREATE_SIGNING_CERTIFICATE_ERROR',
                message: 'unexpected format for signing key',
            });
        }
        // Create signing certificate
        const certificates = await this.ca.createSigningCertificate(identityToken, challenge.key.publicKey, challenge.signature);
        // Generate artifact signature
        const signature = await this.keyHolder.sign(data);
        // Specifically returning only the first certificate in the chain
        // as the key.
        return {
            signature: signature.signature,
            key: {
                $case: 'x509Certificate',
                certificate: certificates[0],
            },
        };
    }
    async getIdentityToken() {
        try {
            return await this.identityProvider.getToken();
        }
        catch (err) {
            throw new error_1.InternalError({
                code: 'IDENTITY_TOKEN_READ_ERROR',
                message: 'error retrieving identity token',
                cause: err,
            });
        }
    }
}
exports.FulcioSigner = FulcioSigner;


/***/ }),

/***/ 34342:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

/* istanbul ignore file */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FulcioSigner = exports.DEFAULT_FULCIO_URL = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
var fulcio_1 = __nccwpck_require__(26303);
Object.defineProperty(exports, "DEFAULT_FULCIO_URL", ({ enumerable: true, get: function () { return fulcio_1.DEFAULT_FULCIO_URL; } }));
Object.defineProperty(exports, "FulcioSigner", ({ enumerable: true, get: function () { return fulcio_1.FulcioSigner; } }));


/***/ }),

/***/ 19100:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ua = exports.oidc = exports.pem = exports.json = exports.encoding = exports.dsse = exports.crypto = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
var core_1 = __nccwpck_require__(83917);
Object.defineProperty(exports, "crypto", ({ enumerable: true, get: function () { return core_1.crypto; } }));
Object.defineProperty(exports, "dsse", ({ enumerable: true, get: function () { return core_1.dsse; } }));
Object.defineProperty(exports, "encoding", ({ enumerable: true, get: function () { return core_1.encoding; } }));
Object.defineProperty(exports, "json", ({ enumerable: true, get: function () { return core_1.json; } }));
Object.defineProperty(exports, "pem", ({ enumerable: true, get: function () { return core_1.pem; } }));
exports.oidc = __importStar(__nccwpck_require__(81963));
exports.ua = __importStar(__nccwpck_require__(81268));


/***/ }),

/***/ 81963:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.extractJWTSubject = extractJWTSubject;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const core_1 = __nccwpck_require__(83917);
function extractJWTSubject(jwt) {
    const parts = jwt.split('.', 3);
    const payload = JSON.parse(core_1.encoding.base64Decode(parts[1]));
    switch (payload.iss) {
        case 'https://accounts.google.com':
        case 'https://oauth2.sigstore.dev/auth':
            return payload.email;
        default:
            return payload.sub;
    }
}


/***/ }),

/***/ 81268:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getUserAgent = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const os_1 = __importDefault(__nccwpck_require__(70857));
// Format User-Agent: <product> / <product-version> (<platform>)
// source: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent
const getUserAgent = () => {
    const packageVersion = (__nccwpck_require__(85896)/* .version */ .rE);
    const nodeVersion = process.version;
    const platformName = os_1.default.platform();
    const archName = os_1.default.arch();
    return `sigstore-js/${packageVersion} (Node ${nodeVersion}) (${platformName}/${archName})`;
};
exports.getUserAgent = getUserAgent;


/***/ }),

/***/ 55383:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

/* istanbul ignore file */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TSAWitness = exports.RekorWitness = exports.DEFAULT_REKOR_URL = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
var tlog_1 = __nccwpck_require__(2566);
Object.defineProperty(exports, "DEFAULT_REKOR_URL", ({ enumerable: true, get: function () { return tlog_1.DEFAULT_REKOR_URL; } }));
Object.defineProperty(exports, "RekorWitness", ({ enumerable: true, get: function () { return tlog_1.RekorWitness; } }));
var tsa_1 = __nccwpck_require__(66936);
Object.defineProperty(exports, "TSAWitness", ({ enumerable: true, get: function () { return tsa_1.TSAWitness; } }));


/***/ }),

/***/ 42815:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TLogClient = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const error_1 = __nccwpck_require__(97841);
const error_2 = __nccwpck_require__(40369);
const rekor_1 = __nccwpck_require__(32688);
class TLogClient {
    constructor(options) {
        this.fetchOnConflict = options.fetchOnConflict ?? false;
        this.rekor = new rekor_1.Rekor({
            baseURL: options.rekorBaseURL,
            retry: options.retry,
            timeout: options.timeout,
        });
    }
    async createEntry(proposedEntry) {
        let entry;
        try {
            entry = await this.rekor.createEntry(proposedEntry);
        }
        catch (err) {
            // If the entry already exists, fetch it (if enabled)
            if (entryExistsError(err) && this.fetchOnConflict) {
                // Grab the UUID of the existing entry from the location header
                /* istanbul ignore next */
                const uuid = err.location.split('/').pop() || '';
                try {
                    entry = await this.rekor.getEntry(uuid);
                }
                catch (err) {
                    (0, error_1.internalError)(err, 'TLOG_FETCH_ENTRY_ERROR', 'error fetching tlog entry');
                }
            }
            else {
                (0, error_1.internalError)(err, 'TLOG_CREATE_ENTRY_ERROR', 'error creating tlog entry');
            }
        }
        return entry;
    }
}
exports.TLogClient = TLogClient;
function entryExistsError(value) {
    return (value instanceof error_2.HTTPError &&
        value.statusCode === 409 &&
        value.location !== undefined);
}


/***/ }),

/***/ 97890:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.toProposedEntry = toProposedEntry;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const bundle_1 = __nccwpck_require__(61040);
const util_1 = __nccwpck_require__(19100);
const SHA256_ALGORITHM = 'sha256';
function toProposedEntry(content, publicKey, 
// TODO: Remove this parameter once have completely switched to 'dsse' entries
entryType = 'dsse') {
    switch (content.$case) {
        case 'dsseEnvelope':
            // TODO: Remove this conditional once have completely ditched "intoto" entries
            if (entryType === 'intoto') {
                return toProposedIntotoEntry(content.dsseEnvelope, publicKey);
            }
            return toProposedDSSEEntry(content.dsseEnvelope, publicKey);
        case 'messageSignature':
            return toProposedHashedRekordEntry(content.messageSignature, publicKey);
    }
}
// Returns a properly formatted Rekor "hashedrekord" entry for the given digest
// and signature
function toProposedHashedRekordEntry(messageSignature, publicKey) {
    const hexDigest = messageSignature.messageDigest.digest.toString('hex');
    const b64Signature = messageSignature.signature.toString('base64');
    const b64Key = util_1.encoding.base64Encode(publicKey);
    return {
        apiVersion: '0.0.1',
        kind: 'hashedrekord',
        spec: {
            data: {
                hash: {
                    algorithm: SHA256_ALGORITHM,
                    value: hexDigest,
                },
            },
            signature: {
                content: b64Signature,
                publicKey: {
                    content: b64Key,
                },
            },
        },
    };
}
// Returns a properly formatted Rekor "dsse" entry for the given DSSE envelope
// and signature
function toProposedDSSEEntry(envelope, publicKey) {
    const envelopeJSON = JSON.stringify((0, bundle_1.envelopeToJSON)(envelope));
    const encodedKey = util_1.encoding.base64Encode(publicKey);
    return {
        apiVersion: '0.0.1',
        kind: 'dsse',
        spec: {
            proposedContent: {
                envelope: envelopeJSON,
                verifiers: [encodedKey],
            },
        },
    };
}
// Returns a properly formatted Rekor "intoto" entry for the given DSSE
// envelope and signature
function toProposedIntotoEntry(envelope, publicKey) {
    // Calculate the value for the payloadHash field in the Rekor entry
    const payloadHash = util_1.crypto
        .digest(SHA256_ALGORITHM, envelope.payload)
        .toString('hex');
    // Calculate the value for the hash field in the Rekor entry
    const envelopeHash = calculateDSSEHash(envelope, publicKey);
    // Collect values for re-creating the DSSE envelope.
    // Double-encode payload and signature cause that's what Rekor expects
    const payload = util_1.encoding.base64Encode(envelope.payload.toString('base64'));
    const sig = util_1.encoding.base64Encode(envelope.signatures[0].sig.toString('base64'));
    const keyid = envelope.signatures[0].keyid;
    const encodedKey = util_1.encoding.base64Encode(publicKey);
    // Create the envelope portion of the entry. Note the inclusion of the
    // publicKey in the signature struct is not a standard part of a DSSE
    // envelope, but is required by Rekor.
    const dsse = {
        payloadType: envelope.payloadType,
        payload: payload,
        signatures: [{ sig, publicKey: encodedKey }],
    };
    // If the keyid is an empty string, Rekor seems to remove it altogether. We
    // need to do the same here so that we can properly recreate the entry for
    // verification.
    if (keyid.length > 0) {
        dsse.signatures[0].keyid = keyid;
    }
    return {
        apiVersion: '0.0.2',
        kind: 'intoto',
        spec: {
            content: {
                envelope: dsse,
                hash: { algorithm: SHA256_ALGORITHM, value: envelopeHash },
                payloadHash: { algorithm: SHA256_ALGORITHM, value: payloadHash },
            },
        },
    };
}
// Calculates the hash of a DSSE envelope for inclusion in a Rekor entry.
// There is no standard way to do this, so the scheme we're using as as
// follows:
//  * payload is base64 encoded
//  * signature is base64 encoded (only the first signature is used)
//  * keyid is included ONLY if it is NOT an empty string
//  * The resulting JSON is canonicalized and hashed to a hex string
function calculateDSSEHash(envelope, publicKey) {
    const dsse = {
        payloadType: envelope.payloadType,
        payload: envelope.payload.toString('base64'),
        signatures: [
            { sig: envelope.signatures[0].sig.toString('base64'), publicKey },
        ],
    };
    // If the keyid is an empty string, Rekor seems to remove it altogether.
    if (envelope.signatures[0].keyid.length > 0) {
        dsse.signatures[0].keyid = envelope.signatures[0].keyid;
    }
    return util_1.crypto
        .digest(SHA256_ALGORITHM, util_1.json.canonicalize(dsse))
        .toString('hex');
}


/***/ }),

/***/ 2566:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RekorWitness = exports.DEFAULT_REKOR_URL = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const util_1 = __nccwpck_require__(19100);
const client_1 = __nccwpck_require__(42815);
const entry_1 = __nccwpck_require__(97890);
exports.DEFAULT_REKOR_URL = 'https://rekor.sigstore.dev';
class RekorWitness {
    constructor(options) {
        this.entryType = options.entryType;
        this.tlog = new client_1.TLogClient({
            ...options,
            rekorBaseURL: options.rekorBaseURL || /* istanbul ignore next */ exports.DEFAULT_REKOR_URL,
        });
    }
    async testify(content, publicKey) {
        const proposedEntry = (0, entry_1.toProposedEntry)(content, publicKey, this.entryType);
        const entry = await this.tlog.createEntry(proposedEntry);
        return toTransparencyLogEntry(entry);
    }
}
exports.RekorWitness = RekorWitness;
function toTransparencyLogEntry(entry) {
    const logID = Buffer.from(entry.logID, 'hex');
    // Parse entry body so we can extract the kind and version.
    const bodyJSON = util_1.encoding.base64Decode(entry.body);
    const entryBody = JSON.parse(bodyJSON);
    const promise = entry?.verification?.signedEntryTimestamp
        ? inclusionPromise(entry.verification.signedEntryTimestamp)
        : undefined;
    const proof = entry?.verification?.inclusionProof
        ? inclusionProof(entry.verification.inclusionProof)
        : undefined;
    const tlogEntry = {
        logIndex: entry.logIndex.toString(),
        logId: {
            keyId: logID,
        },
        integratedTime: entry.integratedTime.toString(),
        kindVersion: {
            kind: entryBody.kind,
            version: entryBody.apiVersion,
        },
        inclusionPromise: promise,
        inclusionProof: proof,
        canonicalizedBody: Buffer.from(entry.body, 'base64'),
    };
    return {
        tlogEntries: [tlogEntry],
    };
}
function inclusionPromise(promise) {
    return {
        signedEntryTimestamp: Buffer.from(promise, 'base64'),
    };
}
function inclusionProof(proof) {
    return {
        logIndex: proof.logIndex.toString(),
        treeSize: proof.treeSize.toString(),
        rootHash: Buffer.from(proof.rootHash, 'hex'),
        hashes: proof.hashes.map((h) => Buffer.from(h, 'hex')),
        checkpoint: {
            envelope: proof.checkpoint,
        },
    };
}


/***/ }),

/***/ 97409:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TSAClient = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const error_1 = __nccwpck_require__(97841);
const tsa_1 = __nccwpck_require__(78963);
const util_1 = __nccwpck_require__(19100);
const SHA256_ALGORITHM = 'sha256';
class TSAClient {
    constructor(options) {
        this.tsa = new tsa_1.TimestampAuthority({
            baseURL: options.tsaBaseURL,
            retry: options.retry,
            timeout: options.timeout,
        });
    }
    async createTimestamp(signature) {
        const request = {
            artifactHash: util_1.crypto
                .digest(SHA256_ALGORITHM, signature)
                .toString('base64'),
            hashAlgorithm: SHA256_ALGORITHM,
        };
        try {
            return await this.tsa.createTimestamp(request);
        }
        catch (err) {
            (0, error_1.internalError)(err, 'TSA_CREATE_TIMESTAMP_ERROR', 'error creating timestamp');
        }
    }
}
exports.TSAClient = TSAClient;


/***/ }),

/***/ 66936:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TSAWitness = void 0;
/*
Copyright 2023 The Sigstore Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const client_1 = __nccwpck_require__(97409);
class TSAWitness {
    constructor(options) {
        this.tsa = new client_1.TSAClient({
            tsaBaseURL: options.tsaBaseURL,
            retry: options.retry,
            timeout: options.timeout,
        });
    }
    async testify(content) {
        const signature = extractSignature(content);
        const timestamp = await this.tsa.createTimestamp(signature);
        return {
            rfc3161Timestamps: [{ signedTimestamp: timestamp }],
        };
    }
}
exports.TSAWitness = TSAWitness;
function extractSignature(content) {
    switch (content.$case) {
        case 'dsseEnvelope':
            return content.dsseEnvelope.signatures[0].sig;
        case 'messageSignature':
            return content.messageSignature.signature;
    }
}


/***/ }),

/***/ 15183:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.req = exports.json = exports.toBuffer = void 0;
const http = __importStar(__nccwpck_require__(58611));
const https = __importStar(__nccwpck_require__(65692));
async function toBuffer(stream) {
    let length = 0;
    const chunks = [];
    for await (const chunk of stream) {
        length += chunk.length;
        chunks.push(chunk);
    }
    return Buffer.concat(chunks, length);
}
exports.toBuffer = toBuffer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(stream) {
    const buf = await toBuffer(stream);
    const str = buf.toString('utf8');
    try {
        return JSON.parse(str);
    }
    catch (_err) {
        const err = _err;
        err.message += ` (input: ${str})`;
        throw err;
    }
}
exports.json = json;
function req(url, opts = {}) {
    const href = typeof url === 'string' ? url : url.href;
    const req = (href.startsWith('https:') ? https : http).request(url, opts);
    const promise = new Promise((resolve, reject) => {
        req
            .once('response', resolve)
            .once('error', reject)
            .end();
    });
    req.then = promise.then.bind(promise);
    return req;
}
exports.req = req;
//# sourceMappingURL=helpers.js.map

/***/ }),

/***/ 98894:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Agent = void 0;
const net = __importStar(__nccwpck_require__(69278));
const http = __importStar(__nccwpck_require__(58611));
const https_1 = __nccwpck_require__(65692);
__exportStar(__nccwpck_require__(15183), exports);
const INTERNAL = Symbol('AgentBaseInternalState');
class Agent extends http.Agent {
    constructor(opts) {
        super(opts);
        this[INTERNAL] = {};
    }
    /**
     * Determine whether this is an `http` or `https` request.
     */
    isSecureEndpoint(options) {
        if (options) {
            // First check the `secureEndpoint` property explicitly, since this
            // means that a parent `Agent` is "passing through" to this instance.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (typeof options.secureEndpoint === 'boolean') {
                return options.secureEndpoint;
            }
            // If no explicit `secure` endpoint, check if `protocol` property is
            // set. This will usually be the case since using a full string URL
            // or `URL` instance should be the most common usage.
            if (typeof options.protocol === 'string') {
                return options.protocol === 'https:';
            }
        }
        // Finally, if no `protocol` property was set, then fall back to
        // checking the stack trace of the current call stack, and try to
        // detect the "https" module.
        const { stack } = new Error();
        if (typeof stack !== 'string')
            return false;
        return stack
            .split('\n')
            .some((l) => l.indexOf('(https.js:') !== -1 ||
            l.indexOf('node:https:') !== -1);
    }
    // In order to support async signatures in `connect()` and Node's native
    // connection pooling in `http.Agent`, the array of sockets for each origin
    // has to be updated synchronously. This is so the length of the array is
    // accurate when `addRequest()` is next called. We achieve this by creating a
    // fake socket and adding it to `sockets[origin]` and incrementing
    // `totalSocketCount`.
    incrementSockets(name) {
        // If `maxSockets` and `maxTotalSockets` are both Infinity then there is no
        // need to create a fake socket because Node.js native connection pooling
        // will never be invoked.
        if (this.maxSockets === Infinity && this.maxTotalSockets === Infinity) {
            return null;
        }
        // All instances of `sockets` are expected TypeScript errors. The
        // alternative is to add it as a private property of this class but that
        // will break TypeScript subclassing.
        if (!this.sockets[name]) {
            // @ts-expect-error `sockets` is readonly in `@types/node`
            this.sockets[name] = [];
        }
        const fakeSocket = new net.Socket({ writable: false });
        this.sockets[name].push(fakeSocket);
        // @ts-expect-error `totalSocketCount` isn't defined in `@types/node`
        this.totalSocketCount++;
        return fakeSocket;
    }
    decrementSockets(name, socket) {
        if (!this.sockets[name] || socket === null) {
            return;
        }
        const sockets = this.sockets[name];
        const index = sockets.indexOf(socket);
        if (index !== -1) {
            sockets.splice(index, 1);
            // @ts-expect-error  `totalSocketCount` isn't defined in `@types/node`
            this.totalSocketCount--;
            if (sockets.length === 0) {
                // @ts-expect-error `sockets` is readonly in `@types/node`
                delete this.sockets[name];
            }
        }
    }
    // In order to properly update the socket pool, we need to call `getName()` on
    // the core `https.Agent` if it is a secureEndpoint.
    getName(options) {
        const secureEndpoint = typeof options.secureEndpoint === 'boolean'
            ? options.secureEndpoint
            : this.isSecureEndpoint(options);
        if (secureEndpoint) {
            // @ts-expect-error `getName()` isn't defined in `@types/node`
            return https_1.Agent.prototype.getName.call(this, options);
        }
        // @ts-expect-error `getName()` isn't defined in `@types/node`
        return super.getName(options);
    }
    createSocket(req, options, cb) {
        const connectOpts = {
            ...options,
            secureEndpoint: this.isSecureEndpoint(options),
        };
        const name = this.getName(connectOpts);
        const fakeSocket = this.incrementSockets(name);
        Promise.resolve()
            .then(() => this.connect(req, connectOpts))
            .then((socket) => {
            this.decrementSockets(name, fakeSocket);
            if (socket instanceof http.Agent) {
                // @ts-expect-error `addRequest()` isn't defined in `@types/node`
                return socket.addRequest(req, connectOpts);
            }
            this[INTERNAL].currentSocket = socket;
            // @ts-expect-error `createSocket()` isn't defined in `@types/node`
            super.createSocket(req, options, cb);
        }, (err) => {
            this.decrementSockets(name, fakeSocket);
            cb(err);
        });
    }
    createConnection() {
        const socket = this[INTERNAL].currentSocket;
        this[INTERNAL].currentSocket = undefined;
        if (!socket) {
            throw new Error('No socket was returned in the `connect()` function');
        }
        return socket;
    }
    get defaultPort() {
        return (this[INTERNAL].defaultPort ??
            (this.protocol === 'https:' ? 443 : 80));
    }
    set defaultPort(v) {
        if (this[INTERNAL]) {
            this[INTERNAL].defaultPort = v;
        }
    }
    get protocol() {
        return (this[INTERNAL].protocol ??
            (this.isSecureEndpoint() ? 'https:' : 'http:'));
    }
    set protocol(v) {
        if (this[INTERNAL]) {
            this[INTERNAL].protocol = v;
        }
    }
}
exports.Agent = Agent;
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 59380:
/***/ ((module) => {

"use strict";

module.exports = balanced;
function balanced(a, b, str) {
  if (a instanceof RegExp) a = maybeMatch(a, str);
  if (b instanceof RegExp) b = maybeMatch(b, str);

  var r = range(a, b, str);

  return r && {
    start: r[0],
    end: r[1],
    pre: str.slice(0, r[0]),
    body: str.slice(r[0] + a.length, r[1]),
    post: str.slice(r[1] + b.length)
  };
}

function maybeMatch(reg, str) {
  var m = str.match(reg);
  return m ? m[0] : null;
}

balanced.range = range;
function range(a, b, str) {
  var begs, beg, left, right, result;
  var ai = str.indexOf(a);
  var bi = str.indexOf(b, ai + 1);
  var i = ai;

  if (ai >= 0 && bi > 0) {
    if(a===b) {
      return [ai, bi];
    }
    begs = [];
    left = str.length;

    while (i >= 0 && !result) {
      if (i == ai) {
        begs.push(i);
        ai = str.indexOf(a, i + 1);
      } else if (begs.length == 1) {
        result = [ begs.pop(), bi ];
      } else {
        beg = begs.pop();
        if (beg < left) {
          left = beg;
          right = bi;
        }

        bi = str.indexOf(b, i + 1);
      }

      i = ai < bi && ai >= 0 ? ai : bi;
    }

    if (begs.length) {
      result = [ left, right ];
    }
  }

  return result;
}


/***/ }),

/***/ 52732:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

var register = __nccwpck_require__(11063);
var addHook = __nccwpck_require__(22027);
var removeHook = __nccwpck_require__(59934);

// bind with array of arguments: https://stackoverflow.com/a/21792913
var bind = Function.bind;
var bindable = bind.bind(bind);

function bindApi(hook, state, name) {
  var removeHookRef = bindable(removeHook, null).apply(
    null,
    name ? [state, name] : [state]
  );
  hook.api = { remove: removeHookRef };
  hook.remove = removeHookRef;
  ["before", "error", "after", "wrap"].forEach(function (kind) {
    var args = name ? [state, kind, name] : [state, kind];
    hook[kind] = hook.api[kind] = bindable(addHook, null).apply(null, args);
  });
}

function HookSingular() {
  var singularHookName = "h";
  var singularHookState = {
    registry: {},
  };
  var singularHook = register.bind(null, singularHookState, singularHookName);
  bindApi(singularHook, singularHookState, singularHookName);
  return singularHook;
}

function HookCollection() {
  var state = {
    registry: {},
  };

  var hook = register.bind(null, state);
  bindApi(hook, state);

  return hook;
}

var collectionHookDeprecationMessageDisplayed = false;
function Hook() {
  if (!collectionHookDeprecationMessageDisplayed) {
    console.warn(
      '[before-after-hook]: "Hook()" repurposing warning, use "Hook.Collection()". Read more: https://git.io/upgrade-before-after-hook-to-1.4'
    );
    collectionHookDeprecationMessageDisplayed = true;
  }
  return HookCollection();
}

Hook.Singular = HookSingular.bind();
Hook.Collection = HookCollection.bind();

module.exports = Hook;
// expose constructors as a named property for TypeScript
module.exports.Hook = Hook;
module.exports.Singular = Hook.Singular;
module.exports.Collection = Hook.Collection;


/***/ }),

/***/ 22027:
/***/ ((module) => {

module.exports = addHook;

function addHook(state, kind, name, hook) {
  var orig = hook;
  if (!state.registry[name]) {
    state.registry[name] = [];
  }

  if (kind === "before") {
    hook = function (method, options) {
      return Promise.resolve()
        .then(orig.bind(null, options))
        .then(method.bind(null, options));
    };
  }

  if (kind === "after") {
    hook = function (method, options) {
      var result;
      return Promise.resolve()
        .then(method.bind(null, options))
        .then(function (result_) {
          result = result_;
          return orig(result, options);
        })
        .then(function () {
          return result;
        });
    };
  }

  if (kind === "error") {
    hook = function (method, options) {
      return Promise.resolve()
        .then(method.bind(null, options))
        .catch(function (error) {
          return orig(error, options);
        });
    };
  }

  state.registry[name].push({
    hook: hook,
    orig: orig,
  });
}


/***/ }),

/***/ 11063:
/***/ ((module) => {

module.exports = register;

function register(state, name, method, options) {
  if (typeof method !== "function") {
    throw new Error("method for before hook must be a function");
  }

  if (!options) {
    options = {};
  }

  if (Array.isArray(name)) {
    return name.reverse().reduce(function (callback, name) {
      return register.bind(null, state, name, callback, options);
    }, method)();
  }

  return Promise.resolve().then(function () {
    if (!state.registry[name]) {
      return method(options);
    }

    return state.registry[name].reduce(function (method, registered) {
      return registered.hook.bind(null, method, options);
    }, method)();
  });
}


/***/ }),

/***/ 59934:
/***/ ((module) => {

module.exports = removeHook;

function removeHook(state, name, method) {
  if (!state.registry[name]) {
    return;
  }

  var index = state.registry[name]
    .map(function (registered) {
      return registered.orig;
    })
    .indexOf(method);

  if (index === -1) {
    return;
  }

  state.registry[name].splice(index, 1);
}


/***/ }),

/***/ 63251:
/***/ (function(module) {

/**
  * This file contains the Bottleneck library (MIT), compiled to ES2017, and without Clustering support.
  * https://github.com/SGrondin/bottleneck
  */
(function (global, factory) {
	 true ? module.exports = factory() :
	0;
}(this, (function () { 'use strict';

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function getCjsExportFromNamespace (n) {
		return n && n['default'] || n;
	}

	var load = function(received, defaults, onto = {}) {
	  var k, ref, v;
	  for (k in defaults) {
	    v = defaults[k];
	    onto[k] = (ref = received[k]) != null ? ref : v;
	  }
	  return onto;
	};

	var overwrite = function(received, defaults, onto = {}) {
	  var k, v;
	  for (k in received) {
	    v = received[k];
	    if (defaults[k] !== void 0) {
	      onto[k] = v;
	    }
	  }
	  return onto;
	};

	var parser = {
		load: load,
		overwrite: overwrite
	};

	var DLList;

	DLList = class DLList {
	  constructor(incr, decr) {
	    this.incr = incr;
	    this.decr = decr;
	    this._first = null;
	    this._last = null;
	    this.length = 0;
	  }

	  push(value) {
	    var node;
	    this.length++;
	    if (typeof this.incr === "function") {
	      this.incr();
	    }
	    node = {
	      value,
	      prev: this._last,
	      next: null
	    };
	    if (this._last != null) {
	      this._last.next = node;
	      this._last = node;
	    } else {
	      this._first = this._last = node;
	    }
	    return void 0;
	  }

	  shift() {
	    var value;
	    if (this._first == null) {
	      return;
	    } else {
	      this.length--;
	      if (typeof this.decr === "function") {
	        this.decr();
	      }
	    }
	    value = this._first.value;
	    if ((this._first = this._first.next) != null) {
	      this._first.prev = null;
	    } else {
	      this._last = null;
	    }
	    return value;
	  }

	  first() {
	    if (this._first != null) {
	      return this._first.value;
	    }
	  }

	  getArray() {
	    var node, ref, results;
	    node = this._first;
	    results = [];
	    while (node != null) {
	      results.push((ref = node, node = node.next, ref.value));
	    }
	    return results;
	  }

	  forEachShift(cb) {
	    var node;
	    node = this.shift();
	    while (node != null) {
	      (cb(node), node = this.shift());
	    }
	    return void 0;
	  }

	  debug() {
	    var node, ref, ref1, ref2, results;
	    node = this._first;
	    results = [];
	    while (node != null) {
	      results.push((ref = node, node = node.next, {
	        value: ref.value,
	        prev: (ref1 = ref.prev) != null ? ref1.value : void 0,
	        next: (ref2 = ref.next) != null ? ref2.value : void 0
	      }));
	    }
	    return results;
	  }

	};

	var DLList_1 = DLList;

	var Events;

	Events = class Events {
	  constructor(instance) {
	    this.instance = instance;
	    this._events = {};
	    if ((this.instance.on != null) || (this.instance.once != null) || (this.instance.removeAllListeners != null)) {
	      throw new Error("An Emitter already exists for this object");
	    }
	    this.instance.on = (name, cb) => {
	      return this._addListener(name, "many", cb);
	    };
	    this.instance.once = (name, cb) => {
	      return this._addListener(name, "once", cb);
	    };
	    this.instance.removeAllListeners = (name = null) => {
	      if (name != null) {
	        return delete this._events[name];
	      } else {
	        return this._events = {};
	      }
	    };
	  }

	  _addListener(name, status, cb) {
	    var base;
	    if ((base = this._events)[name] == null) {
	      base[name] = [];
	    }
	    this._events[name].push({cb, status});
	    return this.instance;
	  }

	  listenerCount(name) {
	    if (this._events[name] != null) {
	      return this._events[name].length;
	    } else {
	      return 0;
	    }
	  }

	  async trigger(name, ...args) {
	    var e, promises;
	    try {
	      if (name !== "debug") {
	        this.trigger("debug", `Event triggered: ${name}`, args);
	      }
	      if (this._events[name] == null) {
	        return;
	      }
	      this._events[name] = this._events[name].filter(function(listener) {
	        return listener.status !== "none";
	      });
	      promises = this._events[name].map(async(listener) => {
	        var e, returned;
	        if (listener.status === "none") {
	          return;
	        }
	        if (listener.status === "once") {
	          listener.status = "none";
	        }
	        try {
	          returned = typeof listener.cb === "function" ? listener.cb(...args) : void 0;
	          if (typeof (returned != null ? returned.then : void 0) === "function") {
	            return (await returned);
	          } else {
	            return returned;
	          }
	        } catch (error) {
	          e = error;
	          {
	            this.trigger("error", e);
	          }
	          return null;
	        }
	      });
	      return ((await Promise.all(promises))).find(function(x) {
	        return x != null;
	      });
	    } catch (error) {
	      e = error;
	      {
	        this.trigger("error", e);
	      }
	      return null;
	    }
	  }

	};

	var Events_1 = Events;

	var DLList$1, Events$1, Queues;

	DLList$1 = DLList_1;

	Events$1 = Events_1;

	Queues = class Queues {
	  constructor(num_priorities) {
	    var i;
	    this.Events = new Events$1(this);
	    this._length = 0;
	    this._lists = (function() {
	      var j, ref, results;
	      results = [];
	      for (i = j = 1, ref = num_priorities; (1 <= ref ? j <= ref : j >= ref); i = 1 <= ref ? ++j : --j) {
	        results.push(new DLList$1((() => {
	          return this.incr();
	        }), (() => {
	          return this.decr();
	        })));
	      }
	      return results;
	    }).call(this);
	  }

	  incr() {
	    if (this._length++ === 0) {
	      return this.Events.trigger("leftzero");
	    }
	  }

	  decr() {
	    if (--this._length === 0) {
	      return this.Events.trigger("zero");
	    }
	  }

	  push(job) {
	    return this._lists[job.options.priority].push(job);
	  }

	  queued(priority) {
	    if (priority != null) {
	      return this._lists[priority].length;
	    } else {
	      return this._length;
	    }
	  }

	  shiftAll(fn) {
	    return this._lists.forEach(function(list) {
	      return list.forEachShift(fn);
	    });
	  }

	  getFirst(arr = this._lists) {
	    var j, len, list;
	    for (j = 0, len = arr.length; j < len; j++) {
	      list = arr[j];
	      if (list.length > 0) {
	        return list;
	      }
	    }
	    return [];
	  }

	  shiftLastFrom(priority) {
	    return this.getFirst(this._lists.slice(priority).reverse()).shift();
	  }

	};

	var Queues_1 = Queues;

	var BottleneckError;

	BottleneckError = class BottleneckError extends Error {};

	var BottleneckError_1 = BottleneckError;

	var BottleneckError$1, DEFAULT_PRIORITY, Job, NUM_PRIORITIES, parser$1;

	NUM_PRIORITIES = 10;

	DEFAULT_PRIORITY = 5;

	parser$1 = parser;

	BottleneckError$1 = BottleneckError_1;

	Job = class Job {
	  constructor(task, args, options, jobDefaults, rejectOnDrop, Events, _states, Promise) {
	    this.task = task;
	    this.args = args;
	    this.rejectOnDrop = rejectOnDrop;
	    this.Events = Events;
	    this._states = _states;
	    this.Promise = Promise;
	    this.options = parser$1.load(options, jobDefaults);
	    this.options.priority = this._sanitizePriority(this.options.priority);
	    if (this.options.id === jobDefaults.id) {
	      this.options.id = `${this.options.id}-${this._randomIndex()}`;
	    }
	    this.promise = new this.Promise((_resolve, _reject) => {
	      this._resolve = _resolve;
	      this._reject = _reject;
	    });
	    this.retryCount = 0;
	  }

	  _sanitizePriority(priority) {
	    var sProperty;
	    sProperty = ~~priority !== priority ? DEFAULT_PRIORITY : priority;
	    if (sProperty < 0) {
	      return 0;
	    } else if (sProperty > NUM_PRIORITIES - 1) {
	      return NUM_PRIORITIES - 1;
	    } else {
	      return sProperty;
	    }
	  }

	  _randomIndex() {
	    return Math.random().toString(36).slice(2);
	  }

	  doDrop({error, message = "This job has been dropped by Bottleneck"} = {}) {
	    if (this._states.remove(this.options.id)) {
	      if (this.rejectOnDrop) {
	        this._reject(error != null ? error : new BottleneckError$1(message));
	      }
	      this.Events.trigger("dropped", {args: this.args, options: this.options, task: this.task, promise: this.promise});
	      return true;
	    } else {
	      return false;
	    }
	  }

	  _assertStatus(expected) {
	    var status;
	    status = this._states.jobStatus(this.options.id);
	    if (!(status === expected || (expected === "DONE" && status === null))) {
	      throw new BottleneckError$1(`Invalid job status ${status}, expected ${expected}. Please open an issue at https://github.com/SGrondin/bottleneck/issues`);
	    }
	  }

	  doReceive() {
	    this._states.start(this.options.id);
	    return this.Events.trigger("received", {args: this.args, options: this.options});
	  }

	  doQueue(reachedHWM, blocked) {
	    this._assertStatus("RECEIVED");
	    this._states.next(this.options.id);
	    return this.Events.trigger("queued", {args: this.args, options: this.options, reachedHWM, blocked});
	  }

	  doRun() {
	    if (this.retryCount === 0) {
	      this._assertStatus("QUEUED");
	      this._states.next(this.options.id);
	    } else {
	      this._assertStatus("EXECUTING");
	    }
	    return this.Events.trigger("scheduled", {args: this.args, options: this.options});
	  }

	  async doExecute(chained, clearGlobalState, run, free) {
	    var error, eventInfo, passed;
	    if (this.retryCount === 0) {
	      this._assertStatus("RUNNING");
	      this._states.next(this.options.id);
	    } else {
	      this._assertStatus("EXECUTING");
	    }
	    eventInfo = {args: this.args, options: this.options, retryCount: this.retryCount};
	    this.Events.trigger("executing", eventInfo);
	    try {
	      passed = (await (chained != null ? chained.schedule(this.options, this.task, ...this.args) : this.task(...this.args)));
	      if (clearGlobalState()) {
	        this.doDone(eventInfo);
	        await free(this.options, eventInfo);
	        this._assertStatus("DONE");
	        return this._resolve(passed);
	      }
	    } catch (error1) {
	      error = error1;
	      return this._onFailure(error, eventInfo, clearGlobalState, run, free);
	    }
	  }

	  doExpire(clearGlobalState, run, free) {
	    var error, eventInfo;
	    if (this._states.jobStatus(this.options.id === "RUNNING")) {
	      this._states.next(this.options.id);
	    }
	    this._assertStatus("EXECUTING");
	    eventInfo = {args: this.args, options: this.options, retryCount: this.retryCount};
	    error = new BottleneckError$1(`This job timed out after ${this.options.expiration} ms.`);
	    return this._onFailure(error, eventInfo, clearGlobalState, run, free);
	  }

	  async _onFailure(error, eventInfo, clearGlobalState, run, free) {
	    var retry, retryAfter;
	    if (clearGlobalState()) {
	      retry = (await this.Events.trigger("failed", error, eventInfo));
	      if (retry != null) {
	        retryAfter = ~~retry;
	        this.Events.trigger("retry", `Retrying ${this.options.id} after ${retryAfter} ms`, eventInfo);
	        this.retryCount++;
	        return run(retryAfter);
	      } else {
	        this.doDone(eventInfo);
	        await free(this.options, eventInfo);
	        this._assertStatus("DONE");
	        return this._reject(error);
	      }
	    }
	  }

	  doDone(eventInfo) {
	    this._assertStatus("EXECUTING");
	    this._states.next(this.options.id);
	    return this.Events.trigger("done", eventInfo);
	  }

	};

	var Job_1 = Job;

	var BottleneckError$2, LocalDatastore, parser$2;

	parser$2 = parser;

	BottleneckError$2 = BottleneckError_1;

	LocalDatastore = class LocalDatastore {
	  constructor(instance, storeOptions, storeInstanceOptions) {
	    this.instance = instance;
	    this.storeOptions = storeOptions;
	    this.clientId = this.instance._randomIndex();
	    parser$2.load(storeInstanceOptions, storeInstanceOptions, this);
	    this._nextRequest = this._lastReservoirRefresh = this._lastReservoirIncrease = Date.now();
	    this._running = 0;
	    this._done = 0;
	    this._unblockTime = 0;
	    this.ready = this.Promise.resolve();
	    this.clients = {};
	    this._startHeartbeat();
	  }

	  _startHeartbeat() {
	    var base;
	    if ((this.heartbeat == null) && (((this.storeOptions.reservoirRefreshInterval != null) && (this.storeOptions.reservoirRefreshAmount != null)) || ((this.storeOptions.reservoirIncreaseInterval != null) && (this.storeOptions.reservoirIncreaseAmount != null)))) {
	      return typeof (base = (this.heartbeat = setInterval(() => {
	        var amount, incr, maximum, now, reservoir;
	        now = Date.now();
	        if ((this.storeOptions.reservoirRefreshInterval != null) && now >= this._lastReservoirRefresh + this.storeOptions.reservoirRefreshInterval) {
	          this._lastReservoirRefresh = now;
	          this.storeOptions.reservoir = this.storeOptions.reservoirRefreshAmount;
	          this.instance._drainAll(this.computeCapacity());
	        }
	        if ((this.storeOptions.reservoirIncreaseInterval != null) && now >= this._lastReservoirIncrease + this.storeOptions.reservoirIncreaseInterval) {
	          ({
	            reservoirIncreaseAmount: amount,
	            reservoirIncreaseMaximum: maximum,
	            reservoir
	          } = this.storeOptions);
	          this._lastReservoirIncrease = now;
	          incr = maximum != null ? Math.min(amount, maximum - reservoir) : amount;
	          if (incr > 0) {
	            this.storeOptions.reservoir += incr;
	            return this.instance._drainAll(this.computeCapacity());
	          }
	        }
	      }, this.heartbeatInterval))).unref === "function" ? base.unref() : void 0;
	    } else {
	      return clearInterval(this.heartbeat);
	    }
	  }

	  async __publish__(message) {
	    await this.yieldLoop();
	    return this.instance.Events.trigger("message", message.toString());
	  }

	  async __disconnect__(flush) {
	    await this.yieldLoop();
	    clearInterval(this.heartbeat);
	    return this.Promise.resolve();
	  }

	  yieldLoop(t = 0) {
	    return new this.Promise(function(resolve, reject) {
	      return setTimeout(resolve, t);
	    });
	  }

	  computePenalty() {
	    var ref;
	    return (ref = this.storeOptions.penalty) != null ? ref : (15 * this.storeOptions.minTime) || 5000;
	  }

	  async __updateSettings__(options) {
	    await this.yieldLoop();
	    parser$2.overwrite(options, options, this.storeOptions);
	    this._startHeartbeat();
	    this.instance._drainAll(this.computeCapacity());
	    return true;
	  }

	  async __running__() {
	    await this.yieldLoop();
	    return this._running;
	  }

	  async __queued__() {
	    await this.yieldLoop();
	    return this.instance.queued();
	  }

	  async __done__() {
	    await this.yieldLoop();
	    return this._done;
	  }

	  async __groupCheck__(time) {
	    await this.yieldLoop();
	    return (this._nextRequest + this.timeout) < time;
	  }

	  computeCapacity() {
	    var maxConcurrent, reservoir;
	    ({maxConcurrent, reservoir} = this.storeOptions);
	    if ((maxConcurrent != null) && (reservoir != null)) {
	      return Math.min(maxConcurrent - this._running, reservoir);
	    } else if (maxConcurrent != null) {
	      return maxConcurrent - this._running;
	    } else if (reservoir != null) {
	      return reservoir;
	    } else {
	      return null;
	    }
	  }

	  conditionsCheck(weight) {
	    var capacity;
	    capacity = this.computeCapacity();
	    return (capacity == null) || weight <= capacity;
	  }

	  async __incrementReservoir__(incr) {
	    var reservoir;
	    await this.yieldLoop();
	    reservoir = this.storeOptions.reservoir += incr;
	    this.instance._drainAll(this.computeCapacity());
	    return reservoir;
	  }

	  async __currentReservoir__() {
	    await this.yieldLoop();
	    return this.storeOptions.reservoir;
	  }

	  isBlocked(now) {
	    return this._unblockTime >= now;
	  }

	  check(weight, now) {
	    return this.conditionsCheck(weight) && (this._nextRequest - now) <= 0;
	  }

	  async __check__(weight) {
	    var now;
	    await this.yieldLoop();
	    now = Date.now();
	    return this.check(weight, now);
	  }

	  async __register__(index, weight, expiration) {
	    var now, wait;
	    await this.yieldLoop();
	    now = Date.now();
	    if (this.conditionsCheck(weight)) {
	      this._running += weight;
	      if (this.storeOptions.reservoir != null) {
	        this.storeOptions.reservoir -= weight;
	      }
	      wait = Math.max(this._nextRequest - now, 0);
	      this._nextRequest = now + wait + this.storeOptions.minTime;
	      return {
	        success: true,
	        wait,
	        reservoir: this.storeOptions.reservoir
	      };
	    } else {
	      return {
	        success: false
	      };
	    }
	  }

	  strategyIsBlock() {
	    return this.storeOptions.strategy === 3;
	  }

	  async __submit__(queueLength, weight) {
	    var blocked, now, reachedHWM;
	    await this.yieldLoop();
	    if ((this.storeOptions.maxConcurrent != null) && weight > this.storeOptions.maxConcurrent) {
	      throw new BottleneckError$2(`Impossible to add a job having a weight of ${weight} to a limiter having a maxConcurrent setting of ${this.storeOptions.maxConcurrent}`);
	    }
	    now = Date.now();
	    reachedHWM = (this.storeOptions.highWater != null) && queueLength === this.storeOptions.highWater && !this.check(weight, now);
	    blocked = this.strategyIsBlock() && (reachedHWM || this.isBlocked(now));
	    if (blocked) {
	      this._unblockTime = now + this.computePenalty();
	      this._nextRequest = this._unblockTime + this.storeOptions.minTime;
	      this.instance._dropAllQueued();
	    }
	    return {
	      reachedHWM,
	      blocked,
	      strategy: this.storeOptions.strategy
	    };
	  }

	  async __free__(index, weight) {
	    await this.yieldLoop();
	    this._running -= weight;
	    this._done += weight;
	    this.instance._drainAll(this.computeCapacity());
	    return {
	      running: this._running
	    };
	  }

	};

	var LocalDatastore_1 = LocalDatastore;

	var BottleneckError$3, States;

	BottleneckError$3 = BottleneckError_1;

	States = class States {
	  constructor(status1) {
	    this.status = status1;
	    this._jobs = {};
	    this.counts = this.status.map(function() {
	      return 0;
	    });
	  }

	  next(id) {
	    var current, next;
	    current = this._jobs[id];
	    next = current + 1;
	    if ((current != null) && next < this.status.length) {
	      this.counts[current]--;
	      this.counts[next]++;
	      return this._jobs[id]++;
	    } else if (current != null) {
	      this.counts[current]--;
	      return delete this._jobs[id];
	    }
	  }

	  start(id) {
	    var initial;
	    initial = 0;
	    this._jobs[id] = initial;
	    return this.counts[initial]++;
	  }

	  remove(id) {
	    var current;
	    current = this._jobs[id];
	    if (current != null) {
	      this.counts[current]--;
	      delete this._jobs[id];
	    }
	    return current != null;
	  }

	  jobStatus(id) {
	    var ref;
	    return (ref = this.status[this._jobs[id]]) != null ? ref : null;
	  }

	  statusJobs(status) {
	    var k, pos, ref, results, v;
	    if (status != null) {
	      pos = this.status.indexOf(status);
	      if (pos < 0) {
	        throw new BottleneckError$3(`status must be one of ${this.status.join(', ')}`);
	      }
	      ref = this._jobs;
	      results = [];
	      for (k in ref) {
	        v = ref[k];
	        if (v === pos) {
	          results.push(k);
	        }
	      }
	      return results;
	    } else {
	      return Object.keys(this._jobs);
	    }
	  }

	  statusCounts() {
	    return this.counts.reduce(((acc, v, i) => {
	      acc[this.status[i]] = v;
	      return acc;
	    }), {});
	  }

	};

	var States_1 = States;

	var DLList$2, Sync;

	DLList$2 = DLList_1;

	Sync = class Sync {
	  constructor(name, Promise) {
	    this.schedule = this.schedule.bind(this);
	    this.name = name;
	    this.Promise = Promise;
	    this._running = 0;
	    this._queue = new DLList$2();
	  }

	  isEmpty() {
	    return this._queue.length === 0;
	  }

	  async _tryToRun() {
	    var args, cb, error, reject, resolve, returned, task;
	    if ((this._running < 1) && this._queue.length > 0) {
	      this._running++;
	      ({task, args, resolve, reject} = this._queue.shift());
	      cb = (await (async function() {
	        try {
	          returned = (await task(...args));
	          return function() {
	            return resolve(returned);
	          };
	        } catch (error1) {
	          error = error1;
	          return function() {
	            return reject(error);
	          };
	        }
	      })());
	      this._running--;
	      this._tryToRun();
	      return cb();
	    }
	  }

	  schedule(task, ...args) {
	    var promise, reject, resolve;
	    resolve = reject = null;
	    promise = new this.Promise(function(_resolve, _reject) {
	      resolve = _resolve;
	      return reject = _reject;
	    });
	    this._queue.push({task, args, resolve, reject});
	    this._tryToRun();
	    return promise;
	  }

	};

	var Sync_1 = Sync;

	var version = "2.19.5";
	var version$1 = {
		version: version
	};

	var version$2 = /*#__PURE__*/Object.freeze({
		version: version,
		default: version$1
	});

	var require$$2 = () => console.log('You must import the full version of Bottleneck in order to use this feature.');

	var require$$3 = () => console.log('You must import the full version of Bottleneck in order to use this feature.');

	var require$$4 = () => console.log('You must import the full version of Bottleneck in order to use this feature.');

	var Events$2, Group, IORedisConnection$1, RedisConnection$1, Scripts$1, parser$3;

	parser$3 = parser;

	Events$2 = Events_1;

	RedisConnection$1 = require$$2;

	IORedisConnection$1 = require$$3;

	Scripts$1 = require$$4;

	Group = (function() {
	  class Group {
	    constructor(limiterOptions = {}) {
	      this.deleteKey = this.deleteKey.bind(this);
	      this.limiterOptions = limiterOptions;
	      parser$3.load(this.limiterOptions, this.defaults, this);
	      this.Events = new Events$2(this);
	      this.instances = {};
	      this.Bottleneck = Bottleneck_1;
	      this._startAutoCleanup();
	      this.sharedConnection = this.connection != null;
	      if (this.connection == null) {
	        if (this.limiterOptions.datastore === "redis") {
	          this.connection = new RedisConnection$1(Object.assign({}, this.limiterOptions, {Events: this.Events}));
	        } else if (this.limiterOptions.datastore === "ioredis") {
	          this.connection = new IORedisConnection$1(Object.assign({}, this.limiterOptions, {Events: this.Events}));
	        }
	      }
	    }

	    key(key = "") {
	      var ref;
	      return (ref = this.instances[key]) != null ? ref : (() => {
	        var limiter;
	        limiter = this.instances[key] = new this.Bottleneck(Object.assign(this.limiterOptions, {
	          id: `${this.id}-${key}`,
	          timeout: this.timeout,
	          connection: this.connection
	        }));
	        this.Events.trigger("created", limiter, key);
	        return limiter;
	      })();
	    }

	    async deleteKey(key = "") {
	      var deleted, instance;
	      instance = this.instances[key];
	      if (this.connection) {
	        deleted = (await this.connection.__runCommand__(['del', ...Scripts$1.allKeys(`${this.id}-${key}`)]));
	      }
	      if (instance != null) {
	        delete this.instances[key];
	        await instance.disconnect();
	      }
	      return (instance != null) || deleted > 0;
	    }

	    limiters() {
	      var k, ref, results, v;
	      ref = this.instances;
	      results = [];
	      for (k in ref) {
	        v = ref[k];
	        results.push({
	          key: k,
	          limiter: v
	        });
	      }
	      return results;
	    }

	    keys() {
	      return Object.keys(this.instances);
	    }

	    async clusterKeys() {
	      var cursor, end, found, i, k, keys, len, next, start;
	      if (this.connection == null) {
	        return this.Promise.resolve(this.keys());
	      }
	      keys = [];
	      cursor = null;
	      start = `b_${this.id}-`.length;
	      end = "_settings".length;
	      while (cursor !== 0) {
	        [next, found] = (await this.connection.__runCommand__(["scan", cursor != null ? cursor : 0, "match", `b_${this.id}-*_settings`, "count", 10000]));
	        cursor = ~~next;
	        for (i = 0, len = found.length; i < len; i++) {
	          k = found[i];
	          keys.push(k.slice(start, -end));
	        }
	      }
	      return keys;
	    }

	    _startAutoCleanup() {
	      var base;
	      clearInterval(this.interval);
	      return typeof (base = (this.interval = setInterval(async() => {
	        var e, k, ref, results, time, v;
	        time = Date.now();
	        ref = this.instances;
	        results = [];
	        for (k in ref) {
	          v = ref[k];
	          try {
	            if ((await v._store.__groupCheck__(time))) {
	              results.push(this.deleteKey(k));
	            } else {
	              results.push(void 0);
	            }
	          } catch (error) {
	            e = error;
	            results.push(v.Events.trigger("error", e));
	          }
	        }
	        return results;
	      }, this.timeout / 2))).unref === "function" ? base.unref() : void 0;
	    }

	    updateSettings(options = {}) {
	      parser$3.overwrite(options, this.defaults, this);
	      parser$3.overwrite(options, options, this.limiterOptions);
	      if (options.timeout != null) {
	        return this._startAutoCleanup();
	      }
	    }

	    disconnect(flush = true) {
	      var ref;
	      if (!this.sharedConnection) {
	        return (ref = this.connection) != null ? ref.disconnect(flush) : void 0;
	      }
	    }

	  }
	  Group.prototype.defaults = {
	    timeout: 1000 * 60 * 5,
	    connection: null,
	    Promise: Promise,
	    id: "group-key"
	  };

	  return Group;

	}).call(commonjsGlobal);

	var Group_1 = Group;

	var Batcher, Events$3, parser$4;

	parser$4 = parser;

	Events$3 = Events_1;

	Batcher = (function() {
	  class Batcher {
	    constructor(options = {}) {
	      this.options = options;
	      parser$4.load(this.options, this.defaults, this);
	      this.Events = new Events$3(this);
	      this._arr = [];
	      this._resetPromise();
	      this._lastFlush = Date.now();
	    }

	    _resetPromise() {
	      return this._promise = new this.Promise((res, rej) => {
	        return this._resolve = res;
	      });
	    }

	    _flush() {
	      clearTimeout(this._timeout);
	      this._lastFlush = Date.now();
	      this._resolve();
	      this.Events.trigger("batch", this._arr);
	      this._arr = [];
	      return this._resetPromise();
	    }

	    add(data) {
	      var ret;
	      this._arr.push(data);
	      ret = this._promise;
	      if (this._arr.length === this.maxSize) {
	        this._flush();
	      } else if ((this.maxTime != null) && this._arr.length === 1) {
	        this._timeout = setTimeout(() => {
	          return this._flush();
	        }, this.maxTime);
	      }
	      return ret;
	    }

	  }
	  Batcher.prototype.defaults = {
	    maxTime: null,
	    maxSize: null,
	    Promise: Promise
	  };

	  return Batcher;

	}).call(commonjsGlobal);

	var Batcher_1 = Batcher;

	var require$$4$1 = () => console.log('You must import the full version of Bottleneck in order to use this feature.');

	var require$$8 = getCjsExportFromNamespace(version$2);

	var Bottleneck, DEFAULT_PRIORITY$1, Events$4, Job$1, LocalDatastore$1, NUM_PRIORITIES$1, Queues$1, RedisDatastore$1, States$1, Sync$1, parser$5,
	  splice = [].splice;

	NUM_PRIORITIES$1 = 10;

	DEFAULT_PRIORITY$1 = 5;

	parser$5 = parser;

	Queues$1 = Queues_1;

	Job$1 = Job_1;

	LocalDatastore$1 = LocalDatastore_1;

	RedisDatastore$1 = require$$4$1;

	Events$4 = Events_1;

	States$1 = States_1;

	Sync$1 = Sync_1;

	Bottleneck = (function() {
	  class Bottleneck {
	    constructor(options = {}, ...invalid) {
	      var storeInstanceOptions, storeOptions;
	      this._addToQueue = this._addToQueue.bind(this);
	      this._validateOptions(options, invalid);
	      parser$5.load(options, this.instanceDefaults, this);
	      this._queues = new Queues$1(NUM_PRIORITIES$1);
	      this._scheduled = {};
	      this._states = new States$1(["RECEIVED", "QUEUED", "RUNNING", "EXECUTING"].concat(this.trackDoneStatus ? ["DONE"] : []));
	      this._limiter = null;
	      this.Events = new Events$4(this);
	      this._submitLock = new Sync$1("submit", this.Promise);
	      this._registerLock = new Sync$1("register", this.Promise);
	      storeOptions = parser$5.load(options, this.storeDefaults, {});
	      this._store = (function() {
	        if (this.datastore === "redis" || this.datastore === "ioredis" || (this.connection != null)) {
	          storeInstanceOptions = parser$5.load(options, this.redisStoreDefaults, {});
	          return new RedisDatastore$1(this, storeOptions, storeInstanceOptions);
	        } else if (this.datastore === "local") {
	          storeInstanceOptions = parser$5.load(options, this.localStoreDefaults, {});
	          return new LocalDatastore$1(this, storeOptions, storeInstanceOptions);
	        } else {
	          throw new Bottleneck.prototype.BottleneckError(`Invalid datastore type: ${this.datastore}`);
	        }
	      }).call(this);
	      this._queues.on("leftzero", () => {
	        var ref;
	        return (ref = this._store.heartbeat) != null ? typeof ref.ref === "function" ? ref.ref() : void 0 : void 0;
	      });
	      this._queues.on("zero", () => {
	        var ref;
	        return (ref = this._store.heartbeat) != null ? typeof ref.unref === "function" ? ref.unref() : void 0 : void 0;
	      });
	    }

	    _validateOptions(options, invalid) {
	      if (!((options != null) && typeof options === "object" && invalid.length === 0)) {
	        throw new Bottleneck.prototype.BottleneckError("Bottleneck v2 takes a single object argument. Refer to https://github.com/SGrondin/bottleneck#upgrading-to-v2 if you're upgrading from Bottleneck v1.");
	      }
	    }

	    ready() {
	      return this._store.ready;
	    }

	    clients() {
	      return this._store.clients;
	    }

	    channel() {
	      return `b_${this.id}`;
	    }

	    channel_client() {
	      return `b_${this.id}_${this._store.clientId}`;
	    }

	    publish(message) {
	      return this._store.__publish__(message);
	    }

	    disconnect(flush = true) {
	      return this._store.__disconnect__(flush);
	    }

	    chain(_limiter) {
	      this._limiter = _limiter;
	      return this;
	    }

	    queued(priority) {
	      return this._queues.queued(priority);
	    }

	    clusterQueued() {
	      return this._store.__queued__();
	    }

	    empty() {
	      return this.queued() === 0 && this._submitLock.isEmpty();
	    }

	    running() {
	      return this._store.__running__();
	    }

	    done() {
	      return this._store.__done__();
	    }

	    jobStatus(id) {
	      return this._states.jobStatus(id);
	    }

	    jobs(status) {
	      return this._states.statusJobs(status);
	    }

	    counts() {
	      return this._states.statusCounts();
	    }

	    _randomIndex() {
	      return Math.random().toString(36).slice(2);
	    }

	    check(weight = 1) {
	      return this._store.__check__(weight);
	    }

	    _clearGlobalState(index) {
	      if (this._scheduled[index] != null) {
	        clearTimeout(this._scheduled[index].expiration);
	        delete this._scheduled[index];
	        return true;
	      } else {
	        return false;
	      }
	    }

	    async _free(index, job, options, eventInfo) {
	      var e, running;
	      try {
	        ({running} = (await this._store.__free__(index, options.weight)));
	        this.Events.trigger("debug", `Freed ${options.id}`, eventInfo);
	        if (running === 0 && this.empty()) {
	          return this.Events.trigger("idle");
	        }
	      } catch (error1) {
	        e = error1;
	        return this.Events.trigger("error", e);
	      }
	    }

	    _run(index, job, wait) {
	      var clearGlobalState, free, run;
	      job.doRun();
	      clearGlobalState = this._clearGlobalState.bind(this, index);
	      run = this._run.bind(this, index, job);
	      free = this._free.bind(this, index, job);
	      return this._scheduled[index] = {
	        timeout: setTimeout(() => {
	          return job.doExecute(this._limiter, clearGlobalState, run, free);
	        }, wait),
	        expiration: job.options.expiration != null ? setTimeout(function() {
	          return job.doExpire(clearGlobalState, run, free);
	        }, wait + job.options.expiration) : void 0,
	        job: job
	      };
	    }

	    _drainOne(capacity) {
	      return this._registerLock.schedule(() => {
	        var args, index, next, options, queue;
	        if (this.queued() === 0) {
	          return this.Promise.resolve(null);
	        }
	        queue = this._queues.getFirst();
	        ({options, args} = next = queue.first());
	        if ((capacity != null) && options.weight > capacity) {
	          return this.Promise.resolve(null);
	        }
	        this.Events.trigger("debug", `Draining ${options.id}`, {args, options});
	        index = this._randomIndex();
	        return this._store.__register__(index, options.weight, options.expiration).then(({success, wait, reservoir}) => {
	          var empty;
	          this.Events.trigger("debug", `Drained ${options.id}`, {success, args, options});
	          if (success) {
	            queue.shift();
	            empty = this.empty();
	            if (empty) {
	              this.Events.trigger("empty");
	            }
	            if (reservoir === 0) {
	              this.Events.trigger("depleted", empty);
	            }
	            this._run(index, next, wait);
	            return this.Promise.resolve(options.weight);
	          } else {
	            return this.Promise.resolve(null);
	          }
	        });
	      });
	    }

	    _drainAll(capacity, total = 0) {
	      return this._drainOne(capacity).then((drained) => {
	        var newCapacity;
	        if (drained != null) {
	          newCapacity = capacity != null ? capacity - drained : capacity;
	          return this._drainAll(newCapacity, total + drained);
	        } else {
	          return this.Promise.resolve(total);
	        }
	      }).catch((e) => {
	        return this.Events.trigger("error", e);
	      });
	    }

	    _dropAllQueued(message) {
	      return this._queues.shiftAll(function(job) {
	        return job.doDrop({message});
	      });
	    }

	    stop(options = {}) {
	      var done, waitForExecuting;
	      options = parser$5.load(options, this.stopDefaults);
	      waitForExecuting = (at) => {
	        var finished;
	        finished = () => {
	          var counts;
	          counts = this._states.counts;
	          return (counts[0] + counts[1] + counts[2] + counts[3]) === at;
	        };
	        return new this.Promise((resolve, reject) => {
	          if (finished()) {
	            return resolve();
	          } else {
	            return this.on("done", () => {
	              if (finished()) {
	                this.removeAllListeners("done");
	                return resolve();
	              }
	            });
	          }
	        });
	      };
	      done = options.dropWaitingJobs ? (this._run = function(index, next) {
	        return next.doDrop({
	          message: options.dropErrorMessage
	        });
	      }, this._drainOne = () => {
	        return this.Promise.resolve(null);
	      }, this._registerLock.schedule(() => {
	        return this._submitLock.schedule(() => {
	          var k, ref, v;
	          ref = this._scheduled;
	          for (k in ref) {
	            v = ref[k];
	            if (this.jobStatus(v.job.options.id) === "RUNNING") {
	              clearTimeout(v.timeout);
	              clearTimeout(v.expiration);
	              v.job.doDrop({
	                message: options.dropErrorMessage
	              });
	            }
	          }
	          this._dropAllQueued(options.dropErrorMessage);
	          return waitForExecuting(0);
	        });
	      })) : this.schedule({
	        priority: NUM_PRIORITIES$1 - 1,
	        weight: 0
	      }, () => {
	        return waitForExecuting(1);
	      });
	      this._receive = function(job) {
	        return job._reject(new Bottleneck.prototype.BottleneckError(options.enqueueErrorMessage));
	      };
	      this.stop = () => {
	        return this.Promise.reject(new Bottleneck.prototype.BottleneckError("stop() has already been called"));
	      };
	      return done;
	    }

	    async _addToQueue(job) {
	      var args, blocked, error, options, reachedHWM, shifted, strategy;
	      ({args, options} = job);
	      try {
	        ({reachedHWM, blocked, strategy} = (await this._store.__submit__(this.queued(), options.weight)));
	      } catch (error1) {
	        error = error1;
	        this.Events.trigger("debug", `Could not queue ${options.id}`, {args, options, error});
	        job.doDrop({error});
	        return false;
	      }
	      if (blocked) {
	        job.doDrop();
	        return true;
	      } else if (reachedHWM) {
	        shifted = strategy === Bottleneck.prototype.strategy.LEAK ? this._queues.shiftLastFrom(options.priority) : strategy === Bottleneck.prototype.strategy.OVERFLOW_PRIORITY ? this._queues.shiftLastFrom(options.priority + 1) : strategy === Bottleneck.prototype.strategy.OVERFLOW ? job : void 0;
	        if (shifted != null) {
	          shifted.doDrop();
	        }
	        if ((shifted == null) || strategy === Bottleneck.prototype.strategy.OVERFLOW) {
	          if (shifted == null) {
	            job.doDrop();
	          }
	          return reachedHWM;
	        }
	      }
	      job.doQueue(reachedHWM, blocked);
	      this._queues.push(job);
	      await this._drainAll();
	      return reachedHWM;
	    }

	    _receive(job) {
	      if (this._states.jobStatus(job.options.id) != null) {
	        job._reject(new Bottleneck.prototype.BottleneckError(`A job with the same id already exists (id=${job.options.id})`));
	        return false;
	      } else {
	        job.doReceive();
	        return this._submitLock.schedule(this._addToQueue, job);
	      }
	    }

	    submit(...args) {
	      var cb, fn, job, options, ref, ref1, task;
	      if (typeof args[0] === "function") {
	        ref = args, [fn, ...args] = ref, [cb] = splice.call(args, -1);
	        options = parser$5.load({}, this.jobDefaults);
	      } else {
	        ref1 = args, [options, fn, ...args] = ref1, [cb] = splice.call(args, -1);
	        options = parser$5.load(options, this.jobDefaults);
	      }
	      task = (...args) => {
	        return new this.Promise(function(resolve, reject) {
	          return fn(...args, function(...args) {
	            return (args[0] != null ? reject : resolve)(args);
	          });
	        });
	      };
	      job = new Job$1(task, args, options, this.jobDefaults, this.rejectOnDrop, this.Events, this._states, this.Promise);
	      job.promise.then(function(args) {
	        return typeof cb === "function" ? cb(...args) : void 0;
	      }).catch(function(args) {
	        if (Array.isArray(args)) {
	          return typeof cb === "function" ? cb(...args) : void 0;
	        } else {
	          return typeof cb === "function" ? cb(args) : void 0;
	        }
	      });
	      return this._receive(job);
	    }

	    schedule(...args) {
	      var job, options, task;
	      if (typeof args[0] === "function") {
	        [task, ...args] = args;
	        options = {};
	      } else {
	        [options, task, ...args] = args;
	      }
	      job = new Job$1(task, args, options, this.jobDefaults, this.rejectOnDrop, this.Events, this._states, this.Promise);
	      this._receive(job);
	      return job.promise;
	    }

	    wrap(fn) {
	      var schedule, wrapped;
	      schedule = this.schedule.bind(this);
	      wrapped = function(...args) {
	        return schedule(fn.bind(this), ...args);
	      };
	      wrapped.withOptions = function(options, ...args) {
	        return schedule(options, fn, ...args);
	      };
	      return wrapped;
	    }

	    async updateSettings(options = {}) {
	      await this._store.__updateSettings__(parser$5.overwrite(options, this.storeDefaults));
	      parser$5.overwrite(options, this.instanceDefaults, this);
	      return this;
	    }

	    currentReservoir() {
	      return this._store.__currentReservoir__();
	    }

	    incrementReservoir(incr = 0) {
	      return this._store.__incrementReservoir__(incr);
	    }

	  }
	  Bottleneck.default = Bottleneck;

	  Bottleneck.Events = Events$4;

	  Bottleneck.version = Bottleneck.prototype.version = require$$8.version;

	  Bottleneck.strategy = Bottleneck.prototype.strategy = {
	    LEAK: 1,
	    OVERFLOW: 2,
	    OVERFLOW_PRIORITY: 4,
	    BLOCK: 3
	  };

	  Bottleneck.BottleneckError = Bottleneck.prototype.BottleneckError = BottleneckError_1;

	  Bottleneck.Group = Bottleneck.prototype.Group = Group_1;

	  Bottleneck.RedisConnection = Bottleneck.prototype.RedisConnection = require$$2;

	  Bottleneck.IORedisConnection = Bottleneck.prototype.IORedisConnection = require$$3;

	  Bottleneck.Batcher = Bottleneck.prototype.Batcher = Batcher_1;

	  Bottleneck.prototype.jobDefaults = {
	    priority: DEFAULT_PRIORITY$1,
	    weight: 1,
	    expiration: null,
	    id: "<no-id>"
	  };

	  Bottleneck.prototype.storeDefaults = {
	    maxConcurrent: null,
	    minTime: 0,
	    highWater: null,
	    strategy: Bottleneck.prototype.strategy.LEAK,
	    penalty: null,
	    reservoir: null,
	    reservoirRefreshInterval: null,
	    reservoirRefreshAmount: null,
	    reservoirIncreaseInterval: null,
	    reservoirIncreaseAmount: null,
	    reservoirIncreaseMaximum: null
	  };

	  Bottleneck.prototype.localStoreDefaults = {
	    Promise: Promise,
	    timeout: null,
	    heartbeatInterval: 250
	  };

	  Bottleneck.prototype.redisStoreDefaults = {
	    Promise: Promise,
	    timeout: null,
	    heartbeatInterval: 5000,
	    clientTimeout: 10000,
	    Redis: null,
	    clientOptions: {},
	    clusterNodes: null,
	    clearDatastore: false,
	    connection: null
	  };

	  Bottleneck.prototype.instanceDefaults = {
	    datastore: "local",
	    connection: null,
	    id: "<no-id>",
	    rejectOnDrop: true,
	    trackDoneStatus: false,
	    Promise: Promise
	  };

	  Bottleneck.prototype.stopDefaults = {
	    enqueueErrorMessage: "This limiter has been stopped and cannot accept new jobs.",
	    dropWaitingJobs: true,
	    dropErrorMessage: "This limiter has been stopped."
	  };

	  return Bottleneck;

	}).call(commonjsGlobal);

	var Bottleneck_1 = Bottleneck;

	var lib = Bottleneck_1;

	return lib;

})));


/***/ }),

/***/ 94691:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

var concatMap = __nccwpck_require__(97087);
var balanced = __nccwpck_require__(59380);

module.exports = expandTop;

var escSlash = '\0SLASH'+Math.random()+'\0';
var escOpen = '\0OPEN'+Math.random()+'\0';
var escClose = '\0CLOSE'+Math.random()+'\0';
var escComma = '\0COMMA'+Math.random()+'\0';
var escPeriod = '\0PERIOD'+Math.random()+'\0';

function numeric(str) {
  return parseInt(str, 10) == str
    ? parseInt(str, 10)
    : str.charCodeAt(0);
}

function escapeBraces(str) {
  return str.split('\\\\').join(escSlash)
            .split('\\{').join(escOpen)
            .split('\\}').join(escClose)
            .split('\\,').join(escComma)
            .split('\\.').join(escPeriod);
}

function unescapeBraces(str) {
  return str.split(escSlash).join('\\')
            .split(escOpen).join('{')
            .split(escClose).join('}')
            .split(escComma).join(',')
            .split(escPeriod).join('.');
}


// Basically just str.split(","), but handling cases
// where we have nested braced sections, which should be
// treated as individual members, like {a,{b,c},d}
function parseCommaParts(str) {
  if (!str)
    return [''];

  var parts = [];
  var m = balanced('{', '}', str);

  if (!m)
    return str.split(',');

  var pre = m.pre;
  var body = m.body;
  var post = m.post;
  var p = pre.split(',');

  p[p.length-1] += '{' + body + '}';
  var postParts = parseCommaParts(post);
  if (post.length) {
    p[p.length-1] += postParts.shift();
    p.push.apply(p, postParts);
  }

  parts.push.apply(parts, p);

  return parts;
}

function expandTop(str) {
  if (!str)
    return [];

  // I don't know why Bash 4.3 does this, but it does.
  // Anything starting with {} will have the first two bytes preserved
  // but *only* at the top level, so {},a}b will not expand to anything,
  // but a{},b}c will be expanded to [a}c,abc].
  // One could argue that this is a bug in Bash, but since the goal of
  // this module is to match Bash's rules, we escape a leading {}
  if (str.substr(0, 2) === '{}') {
    str = '\\{\\}' + str.substr(2);
  }

  return expand(escapeBraces(str), true).map(unescapeBraces);
}

function identity(e) {
  return e;
}

function embrace(str) {
  return '{' + str + '}';
}
function isPadded(el) {
  return /^-?0\d/.test(el);
}

function lte(i, y) {
  return i <= y;
}
function gte(i, y) {
  return i >= y;
}

function expand(str, isTop) {
  var expansions = [];

  var m = balanced('{', '}', str);
  if (!m || /\$$/.test(m.pre)) return [str];

  var isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
  var isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
  var isSequence = isNumericSequence || isAlphaSequence;
  var isOptions = m.body.indexOf(',') >= 0;
  if (!isSequence && !isOptions) {
    // {a},b}
    if (m.post.match(/,(?!,).*\}/)) {
      str = m.pre + '{' + m.body + escClose + m.post;
      return expand(str);
    }
    return [str];
  }

  var n;
  if (isSequence) {
    n = m.body.split(/\.\./);
  } else {
    n = parseCommaParts(m.body);
    if (n.length === 1) {
      // x{{a,b}}y ==> x{a}y x{b}y
      n = expand(n[0], false).map(embrace);
      if (n.length === 1) {
        var post = m.post.length
          ? expand(m.post, false)
          : [''];
        return post.map(function(p) {
          return m.pre + n[0] + p;
        });
      }
    }
  }

  // at this point, n is the parts, and we know it's not a comma set
  // with a single entry.

  // no need to expand pre, since it is guaranteed to be free of brace-sets
  var pre = m.pre;
  var post = m.post.length
    ? expand(m.post, false)
    : [''];

  var N;

  if (isSequence) {
    var x = numeric(n[0]);
    var y = numeric(n[1]);
    var width = Math.max(n[0].length, n[1].length)
    var incr = n.length == 3
      ? Math.abs(numeric(n[2]))
      : 1;
    var test = lte;
    var reverse = y < x;
    if (reverse) {
      incr *= -1;
      test = gte;
    }
    var pad = n.some(isPadded);

    N = [];

    for (var i = x; test(i, y); i += incr) {
      var c;
      if (isAlphaSequence) {
        c = String.fromCharCode(i);
        if (c === '\\')
          c = '';
      } else {
        c = String(i);
        if (pad) {
          var need = width - c.length;
          if (need > 0) {
            var z = new Array(need + 1).join('0');
            if (i < 0)
              c = '-' + z + c.slice(1);
            else
              c = z + c;
          }
        }
      }
      N.push(c);
    }
  } else {
    N = concatMap(n, function(el) { return expand(el, false) });
  }

  for (var j = 0; j < N.length; j++) {
    for (var k = 0; k < post.length; k++) {
      var expansion = pre + N[j] + post[k];
      if (!isTop || isSequence || expansion)
        expansions.push(expansion);
    }
  }

  return expansions;
}



/***/ }),

/***/ 40233:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const contentVer = (__nccwpck_require__(4038)/* ["cache-version"].content */ .MH.Q)
const hashToSegments = __nccwpck_require__(99704)
const path = __nccwpck_require__(16928)
const ssri = __nccwpck_require__(68951)

// Current format of content file path:
//
// sha512-BaSE64Hex= ->
// ~/.my-cache/content-v2/sha512/ba/da/55deadbeefc0ffee
//
module.exports = contentPath

function contentPath (cache, integrity) {
  const sri = ssri.parse(integrity, { single: true })
  // contentPath is the *strongest* algo given
  return path.join(
    contentDir(cache),
    sri.algorithm,
    ...hashToSegments(sri.hexDigest())
  )
}

module.exports.contentDir = contentDir

function contentDir (cache) {
  return path.join(cache, `content-v${contentVer}`)
}


/***/ }),

/***/ 39398:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const fs = __nccwpck_require__(91943)
const fsm = __nccwpck_require__(25032)
const ssri = __nccwpck_require__(68951)
const contentPath = __nccwpck_require__(40233)
const Pipeline = __nccwpck_require__(52899)

module.exports = read

const MAX_SINGLE_READ_SIZE = 64 * 1024 * 1024
async function read (cache, integrity, opts = {}) {
  const { size } = opts
  const { stat, cpath, sri } = await withContentSri(cache, integrity, async (cpath, sri) => {
    // get size
    const stat = size ? { size } : await fs.stat(cpath)
    return { stat, cpath, sri }
  })

  if (stat.size > MAX_SINGLE_READ_SIZE) {
    return readPipeline(cpath, stat.size, sri, new Pipeline()).concat()
  }

  const data = await fs.readFile(cpath, { encoding: null })

  if (stat.size !== data.length) {
    throw sizeError(stat.size, data.length)
  }

  if (!ssri.checkData(data, sri)) {
    throw integrityError(sri, cpath)
  }

  return data
}

const readPipeline = (cpath, size, sri, stream) => {
  stream.push(
    new fsm.ReadStream(cpath, {
      size,
      readSize: MAX_SINGLE_READ_SIZE,
    }),
    ssri.integrityStream({
      integrity: sri,
      size,
    })
  )
  return stream
}

module.exports.stream = readStream
module.exports.readStream = readStream

function readStream (cache, integrity, opts = {}) {
  const { size } = opts
  const stream = new Pipeline()
  // Set all this up to run on the stream and then just return the stream
  Promise.resolve().then(async () => {
    const { stat, cpath, sri } = await withContentSri(cache, integrity, async (cpath, sri) => {
      // get size
      const stat = size ? { size } : await fs.stat(cpath)
      return { stat, cpath, sri }
    })

    return readPipeline(cpath, stat.size, sri, stream)
  }).catch(err => stream.emit('error', err))

  return stream
}

module.exports.copy = copy

function copy (cache, integrity, dest) {
  return withContentSri(cache, integrity, (cpath) => {
    return fs.copyFile(cpath, dest)
  })
}

module.exports.hasContent = hasContent

async function hasContent (cache, integrity) {
  if (!integrity) {
    return false
  }

  try {
    return await withContentSri(cache, integrity, async (cpath, sri) => {
      const stat = await fs.stat(cpath)
      return { size: stat.size, sri, stat }
    })
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false
    }

    if (err.code === 'EPERM') {
      /* istanbul ignore else */
      if (process.platform !== 'win32') {
        throw err
      } else {
        return false
      }
    }
  }
}

async function withContentSri (cache, integrity, fn) {
  const sri = ssri.parse(integrity)
  // If `integrity` has multiple entries, pick the first digest
  // with available local data.
  const algo = sri.pickAlgorithm()
  const digests = sri[algo]

  if (digests.length <= 1) {
    const cpath = contentPath(cache, digests[0])
    return fn(cpath, digests[0])
  } else {
    // Can't use race here because a generic error can happen before
    // a ENOENT error, and can happen before a valid result
    const results = await Promise.all(digests.map(async (meta) => {
      try {
        return await withContentSri(cache, meta, fn)
      } catch (err) {
        if (err.code === 'ENOENT') {
          return Object.assign(
            new Error('No matching content found for ' + sri.toString()),
            { code: 'ENOENT' }
          )
        }
        return err
      }
    }))
    // Return the first non error if it is found
    const result = results.find((r) => !(r instanceof Error))
    if (result) {
      return result
    }

    // Throw the No matching content found error
    const enoentError = results.find((r) => r.code === 'ENOENT')
    if (enoentError) {
      throw enoentError
    }

    // Throw generic error
    throw results.find((r) => r instanceof Error)
  }
}

function sizeError (expected, found) {
  /* eslint-disable-next-line max-len */
  const err = new Error(`Bad data size: expected inserted data to be ${expected} bytes, but got ${found} instead`)
  err.expected = expected
  err.found = found
  err.code = 'EBADSIZE'
  return err
}

function integrityError (sri, path) {
  const err = new Error(`Integrity verification failed for ${sri} (${path})`)
  err.code = 'EINTEGRITY'
  err.sri = sri
  err.path = path
  return err
}


/***/ }),

/***/ 92447:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const fs = __nccwpck_require__(91943)
const contentPath = __nccwpck_require__(40233)
const { hasContent } = __nccwpck_require__(39398)

module.exports = rm

async function rm (cache, integrity) {
  const content = await hasContent(cache, integrity)
  // ~pretty~ sure we can't end up with a content lacking sri, but be safe
  if (content && content.sri) {
    await fs.rm(contentPath(cache, content.sri), { recursive: true, force: true })
    return true
  } else {
    return false
  }
}


/***/ }),

/***/ 93699:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";


const events = __nccwpck_require__(24434)

const contentPath = __nccwpck_require__(40233)
const fs = __nccwpck_require__(91943)
const { moveFile } = __nccwpck_require__(88437)
const { Minipass } = __nccwpck_require__(78275)
const Pipeline = __nccwpck_require__(52899)
const Flush = __nccwpck_require__(37633)
const path = __nccwpck_require__(16928)
const ssri = __nccwpck_require__(68951)
const uniqueFilename = __nccwpck_require__(46019)
const fsm = __nccwpck_require__(25032)

module.exports = write

// Cache of move operations in process so we don't duplicate
const moveOperations = new Map()

async function write (cache, data, opts = {}) {
  const { algorithms, size, integrity } = opts

  if (typeof size === 'number' && data.length !== size) {
    throw sizeError(size, data.length)
  }

  const sri = ssri.fromData(data, algorithms ? { algorithms } : {})
  if (integrity && !ssri.checkData(data, integrity, opts)) {
    throw checksumError(integrity, sri)
  }

  for (const algo in sri) {
    const tmp = await makeTmp(cache, opts)
    const hash = sri[algo].toString()
    try {
      await fs.writeFile(tmp.target, data, { flag: 'wx' })
      await moveToDestination(tmp, cache, hash, opts)
    } finally {
      if (!tmp.moved) {
        await fs.rm(tmp.target, { recursive: true, force: true })
      }
    }
  }
  return { integrity: sri, size: data.length }
}

module.exports.stream = writeStream

// writes proxied to the 'inputStream' that is passed to the Promise
// 'end' is deferred until content is handled.
class CacacheWriteStream extends Flush {
  constructor (cache, opts) {
    super()
    this.opts = opts
    this.cache = cache
    this.inputStream = new Minipass()
    this.inputStream.on('error', er => this.emit('error', er))
    this.inputStream.on('drain', () => this.emit('drain'))
    this.handleContentP = null
  }

  write (chunk, encoding, cb) {
    if (!this.handleContentP) {
      this.handleContentP = handleContent(
        this.inputStream,
        this.cache,
        this.opts
      )
      this.handleContentP.catch(error => this.emit('error', error))
    }
    return this.inputStream.write(chunk, encoding, cb)
  }

  flush (cb) {
    this.inputStream.end(() => {
      if (!this.handleContentP) {
        const e = new Error('Cache input stream was empty')
        e.code = 'ENODATA'
        // empty streams are probably emitting end right away.
        // defer this one tick by rejecting a promise on it.
        return Promise.reject(e).catch(cb)
      }
      // eslint-disable-next-line promise/catch-or-return
      this.handleContentP.then(
        (res) => {
          res.integrity &&