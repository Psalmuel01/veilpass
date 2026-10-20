import { describe, it, expect, vi, afterEach } from "vitest";
import { connectSignedWallet } from "../apps/web/lib/signed-midnight";
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
