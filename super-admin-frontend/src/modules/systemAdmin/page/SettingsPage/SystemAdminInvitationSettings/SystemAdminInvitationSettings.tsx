"use client";

import { useState } from "react";
import { Box, Typography } from "@mui/material";
import { Button } from "@/modules/shared/component/Button";
import { useMutationService } from "@/utils/hooks/useMutationService";
import { authServices } from "@/services/auth.service";
import { showToast } from "@/modules/shared/component/Toast";
import { TextField } from "@/modules/shared/component/TextField";

export const SystemAdminInvitationSettings = () => {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const { mutateAsync: inviteSystemAdmin, isPending } = useMutationService({
    service: authServices.inviteUser,
    options: {
      disableToast: true,
    },
  });

  const handleInvite = async () => {
    if (!email || !firstName || !lastName) return;
    try {
      await inviteSystemAdmin({ email, firstName, lastName });
      showToast({
        message: "Invitation Sent",
        description: `Successfully invited ${email} to be a System Admin.`,
        severity: "success",
      });
      setEmail("");
      setFirstName("");
      setLastName("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.log("Failed to send invitation:", error);
      showToast({
        message: "Failed to send invitation",
        description: error?.message || "An unexpected error occurred",
        severity: "error",
      });
    }
  };

  return (
    <Box className="rounded-lg bg-white flex flex-col gap-5 p-4 sm:p-5">
      <Box className="flex flex-col gap-1">
        <Typography className="!text-lg !font-semibold">
          Invite System Admin
        </Typography>
        <Typography className="!text-sm text-gray-600">
          Send an invitation email to add a new system administrator. They will have full access across all schools.
        </Typography>
      </Box>

      <Box className="flex flex-col gap-4">
        <Box className="flex gap-4">
          <Box className="flex-1">
            <TextField
              label="First Name"
              placeholder="Enter first name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              labelOnTop
              labelClassName="!text-sm !font-medium !text-input-gray"
              inputClasses="mt-1 !text-sm !h-10 !text-input-gray placeholder:!text-input-gray"
            />
          </Box>
          <Box className="flex-1">
            <TextField
              label="Last Name"
              placeholder="Enter last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              labelOnTop
              labelClassName="!text-sm !font-medium !text-input-gray"
              inputClasses="mt-1 !text-sm !h-10 !text-input-gray placeholder:!text-input-gray"
            />
          </Box>
        </Box>
        <Box className="flex-1">
          <TextField
            label="Email Address"
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            labelOnTop
            labelClassName="!text-sm !font-medium !text-input-gray"
            inputClasses="mt-1 !text-sm !h-10 !text-input-gray placeholder:!text-input-gray"
          />
        </Box>
      </Box>
      <Box className="flex justify-end md:mt-0 mt-6">
        <Button
          onClick={handleInvite}
          disabled={!email || !firstName || !lastName || isPending}
          className="rounded-lg! w-full sm:!w-fit"
        >
          {isPending ? "Sending..." : "Send Invite"}
        </Button>
      </Box>
    </Box>
  );
};
