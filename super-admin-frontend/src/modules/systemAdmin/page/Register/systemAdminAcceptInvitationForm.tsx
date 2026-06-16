"use client";

import { Box, Typography } from "@mui/material";
import { CWTextField } from "@/modules/shared/component/FormFields/CWTextField";
import { Button } from "@/modules/shared/component/Button";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutationService } from "@/utils/hooks/useMutationService";
import { authServices } from "@/services/auth.service";
import { useFormValidator } from "@/utils/hooks/useFormValidator";
import * as Yup from "yup";
import { useEffect, useState } from "react";
import ChevronLeftIcon from "@/modules/shared/assets/svgs/leftIconWhite.svg";

const validationSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email address").required("Email is required"),
  firstName: Yup.string().required("First name is required"),
  lastName: Yup.string().required("Last name is required"),
  password: Yup.string().required("Password is required").min(8, "Password must be at least 8 characters"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password")], "Passwords must match")
    .required("Confirm Password is required"),
});

export default function SystemAdminAcceptInvitationForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token");
  const urlEmail = searchParams.get("email");
  const urlFirstName = searchParams.get("firstName");
  const urlLastName = searchParams.get("lastName");

  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    if (token) {
      setHasToken(true);
    } else {
      router.push("/system-admin/login");
    }
  }, [token, router]);

  const { control, handleSubmit, reset } = useFormValidator({
    validationSchema,
    defaultValues: {
      email: urlEmail || "",
      firstName: urlFirstName || "",
      lastName: urlLastName || "",
      password: "",
      confirmPassword: "",
    },
  });

  const { mutateAsync: acceptInviteAsync, isPending } = useMutationService({
    service: authServices.acceptInvitation,
    options: {
      successTitle: "Registration successful!",
      successMessage: "You can now log in to your system admin account.",
      errorTitle: "Failed to register",
      isFormData: false,
      onSuccess: () => {
        router.push("/system-admin/login");
      },
    },
  });

  const onSubmit = async (values: Record<string, string>) => {
    if (!token) return;

    await acceptInviteAsync({
      token,
      email: values.email,
      firstName: values.firstName,
      lastName: values.lastName,
      password: values.password,
    } as unknown as never);
  };

  if (!hasToken) {
    return null;
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%", position: "relative" }}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="relative flex w-full max-w-[500px] flex-col gap-5 rounded-2xl bg-white p-5 shadow-md sm:gap-6 sm:p-8 md:p-12"
      >
        <Box className="flex flex-col gap-4">
          <Box className="flex items-center justify-between gap-3">
            <Box
              onClick={() => router.push("/system-admin/login")}
              className="cursor-pointer bg-brandColor-active flex items-center justify-center rounded-full !text-white p-2.5"
            >
              <ChevronLeftIcon />
            </Box>
            <Box className="text-center flex flex-col gap-1 px-3">
              <Typography className="!font-bold !text-secondary-text-gray leading-[1.2] !text-2xl">
                Accept Invitation
              </Typography>
              <Typography className="!text-secondary-text-gray !font-normal !text-sm">
                Create your password to activate your system admin account.
              </Typography>
            </Box>
          </Box>

          <CWTextField
            control={control}
            name="firstName"
            label="First Name"
            placeholder="Enter your first name"
            labelOnTop
            fullWidth
            labelClassName="!text-sm !font-medium !text-input-gray"
            inputClasses="mt-1 !text-sm !h-10 !text-input-gray placeholder:!text-input-gray"
            className="flex-1"
          />

          <CWTextField
            control={control}
            name="lastName"
            label="Last Name"
            placeholder="Enter your last name"
            labelOnTop
            fullWidth
            labelClassName="!text-sm !font-medium !text-input-gray"
            inputClasses="mt-1 !text-sm !h-10 !text-input-gray placeholder:!text-input-gray"
            className="flex-1"
          />

          <CWTextField
            control={control}
            name="email"
            label="Email Address"
            placeholder="Enter your email"
            labelOnTop
            fullWidth
            disabled
            labelClassName="!text-sm !font-medium !text-input-gray"
            inputClasses="mt-1 !text-sm !h-10 !text-input-gray placeholder:!text-input-gray"
            className="flex-1"
          />

          <CWTextField
            control={control}
            name="password"
            label="Password"
            type="password"
            placeholder="Enter your password"
            labelOnTop
            fullWidth
            labelClassName="!text-sm !font-medium !text-input-gray"
            inputClasses="mt-1 !text-sm !h-10 !text-input-gray placeholder:!text-input-gray"
            className="flex-1"
          />

          <CWTextField
            control={control}
            name="confirmPassword"
            label="Confirm Password"
            type="password"
            placeholder="Confirm your password"
            labelOnTop
            fullWidth
            labelClassName="!text-sm !font-medium !text-input-gray"
            inputClasses="mt-1 !text-sm !h-10 !text-input-gray placeholder:!text-input-gray"
            className="flex-1"
          />

          <Button
            className="text-primary-white !rounded-lg"
            fullWidth
            type="submit"
            disabled={isPending}
            sx={{
              textTransform: "none",
              borderRadius: "8px",
              height: "48px",
              py: 1.2,
              cursor: isPending ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "Activating..." : "Activate Account"}
          </Button>
        </Box>
      </form>
    </Box>
  );
}
