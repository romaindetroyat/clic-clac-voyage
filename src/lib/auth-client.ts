"use client";

import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Même origine que la page : aucune URL absolue codée en dur.
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
