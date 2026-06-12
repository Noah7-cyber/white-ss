"use client";

import { useState } from "react";
import { Box, Typography } from "@mui/material";
import { Button } from "@/modules/shared/component/Button";
import { useMutationService } from "@/utils/hooks/useMutationService";
import { authDynamicEndpoints } from "@/services/auth.service";
import { showToast } from "@/modules/shared/component/Toast";
import { TextField } from "@/modules/shared/component/TextField";

export const SystemAdminInvitationSettings = () => {
  const [email, setEmail] = useState("");

  const { mutateAsync: inviteSystemAdmin, isPending } = useMutationService({
    service: authDynamicEndpoints.inviteUser,
    options: {
      disableToast: true,
    },
  });

  const handleInvite = async () => {
    if (!email) return;
    try {
      await inviteSystemAdmin({ email });
      showToast({
        message: "Invitation Sent",
        description: `Successfully invited ${email} to be a System Admin.`,
        severity: "success",
      });
      setEmail("");
    } catch (error: { response?: { data?: { message?: string } } }) {
      showToast({
        message: "Failed to send invitation",
        description: error?.response?.data?.message || "An error occurred",
        severity: "error",
      });
    }
  };

  return (
    <Box className="max-w-2xl">
      <Typography className="!text-xl !font-semibold mb-6">
        Invite System Admin
      </Typography>

      <Typography className="!text-sm mb-4 text-gray-600">
        Send an invitation email to add a new system administrator. They will have full access across all schools.
      </Typography>

      <Box className="flex gap-4 items-end">
        <Box className="flex-1">
          <TextField
            label="Email Address"
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
        </Box>
        <Button
          onClick={handleInvite}
          disabled={!email || isPending}
          className="h-12 !px-8"
        >
          {isPending ? "Sending..." : "Send Invite"}
        </Button>
      </Box>
    </Box>
  );
};
