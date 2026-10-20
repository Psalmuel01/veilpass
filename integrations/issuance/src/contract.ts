// SPDX-License-Identifier: Apache-2.0
import {
  Contract,
  type Witnesses,
  type StatusPath,
} from "../managed-authorization/contract/index.js";
import type { PresentationWitness } from "./index.js";
export type PrivateStateV3 = {
  witness: PresentationWitness;
  path: StatusPath;
  admin: Uint8Array;
};
export const witnessesV3: Witnesses<PrivateStateV3> = {
  signedCredential: ({ privateState }) => [
    privateState,
    privateState.witness.qualification.credential,
  ],
  privateClaims: ({ privateState }) => [
    privateState,
    privateState.witness.qualification.claims,
  ],
  issuerSignature: ({ privateState }) => [
    privateState,
    privateState.witness.qualification.proof,
  ],
  signedPresentation: ({ privateState }) => [
    privateState,
    privateState.witness.presentation,
  ],
  holderSignature: ({ privateState }) => [
    privateState,
    privateState.witness.proof,
  ],
  currentStatusPath: ({ privateState }) => [privateState, privateState.path],
  administratorSecret: ({ privateState }) => [privateState, privateState.admin],
};
export const signedContract = new Contract(witnessesV3);
