import "server-only";
import { OwnerLoginLimit } from "./admin-login-rate";
import { getGiftDatabase } from "./gift-library";
import { isHostedDeployment } from "./deployment-config";
import { resetDatabaseLoginAttempts, takeDatabaseLoginAttempt } from "../db/login-limit";

const state = globalThis as typeof globalThis & { ownerLoginLimitV3?: OwnerLoginLimit };
state.ownerLoginLimitV3 ??= new OwnerLoginLimit();

export async function takeOwnerLoginAttempt(key: string) {
  return isHostedDeployment() ? takeDatabaseLoginAttempt(await getGiftDatabase("editor"), key) :
    state.ownerLoginLimitV3!.take(key);
}

export async function resetOwnerLoginAttempts(key: string) {
  if (isHostedDeployment()) await resetDatabaseLoginAttempts(await getGiftDatabase("editor"), key);
  else state.ownerLoginLimitV3!.reset(key);
}
