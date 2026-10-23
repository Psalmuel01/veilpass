import { describe, it, expect, vi, afterEach } from "vitest";
import { connectSignedWallet, proveSigned } from "../apps/web/lib/signed-midnight";
import type { SignedNetworkConfig } from "../apps/web/lib/signed-midnight";
const config = { network: "preprod" } as SignedNetworkConfig;
afterEach(() => vi.unstubAllGlobals());
describe("V3 wallet connection boundaries", () => {
  it("reports missing extensions and propagates declined approval", async () => {
    vi.stubGlobal("window", {});
    await expect(connectSignedWallet("lace", config)).rejects.toThrow(
      "Install",
    );
    vi.stubGlobal("window", {
      midnight: {
        lace: {
          connect: async () => {
            throw Error("User declined");
          },
        },
      },
    });
    await expect(connectSignedWallet("lace", config)).rejects.toThrow(
      "declined",
    );
  });
  it("rejects a wallet on the wrong network", async () => {
    vi.stubGlobal("window", {
      midnight: {
        lace: {
          connect: async () => ({
            getConfiguration: async () => ({ networkId: "preview" }),
          }),
        },
      },
    });
    await expect(connectSignedWallet("lace", config)).rejects.toThrow("Switch");
  });
});

it("refuses remote proving before constructing witnesses or calling a wallet/provider", async () => {
 const remote = {network: "preprod", domain: "11".repeat(32), contractAddress: "22".repeat(32),
  appA: "33".repeat(32), appB: "44".repeat(32), proofServer: "https://prover.example.test",
  trustedProverOrigin: "https://prover.example.test"} as SignedNetworkConfig;
 const challenge = {version: 3, domain: remote.domain, contractAddress: remote.contractAddress,
  audience: remote.appA, policy: 1, expiresAt: Math.floor(Date.now()/1000)+300} as Parameters<typeof proveSigned>[5];
 const present = vi.fn(), getConfiguration = vi.fn(), fetch = vi.fn();
 vi.stubGlobal("fetch", fetch);
 for (const consent of [undefined, "https://unrelated.example.test"]) {
  await expect(proveSigned(
   {getConfiguration} as unknown as Parameters<typeof proveSigned>[0],
   {present} as unknown as Parameters<typeof proveSigned>[1],
   "synthetic", {} as Parameters<typeof proveSigned>[3], remote, challenge, vi.fn(), consent,
  )).rejects.toThrow("Consent");
 }
 expect(present).not.toHaveBeenCalled();
 expect(getConfiguration).not.toHaveBeenCalled();
 expect(fetch).not.toHaveBeenCalled();
});
