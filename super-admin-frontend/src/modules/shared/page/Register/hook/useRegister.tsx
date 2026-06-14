/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRouter } from "next/navigation";
import { authServices } from "@/services/auth.service";
import { useMutationService } from "@/utils/hooks/useMutationService";
import { useFormValidator } from "@/utils/hooks/useFormValidator";
import { RegisterFormValues, initialValue, validationSchema } from "../auth.constant";
import { AuthRoutes } from "@/routes/auth.routes";

type RegisterRoleParam = "admin" | "parent" | undefined;

interface UseRegisterParams {
  role?: RegisterRoleParam;
  token?: string;
}

export function useRegister(params?: UseRegisterParams) {
  const router = useRouter();

  const formInstance = useFormValidator<RegisterFormValues>({
    validationSchema,
    defaultValues: {
      ...initialValue,
    },
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  const { control, handleSubmit } = formInstance;

  const { mutateAsync: registerAsync, isPending: isRegisterPending } = useMutationService({
    service: authServices.register,
    options: {
      successTitle: "Registration successful!",
      successMessage: params?.token
        ? "Please log in to your account."
        : "Please verify your email to complete registration.",
      errorTitle: "Registration failed",
      isFormData: false,
      onSuccess: (response: unknown) => {
        const typedResponse = response as any;

        // Check if this is an invited user (has token in payload)
        const isInvitedUser = Boolean(params?.token);

        if (isInvitedUser) {
          // Check if it's the system-admin path
          if (typeof window !== "undefined" && window.location.pathname.includes("/system-admin")) {
            router.push("/system-admin/login");
          } else {
            // Invited users route to login to now log in to the account
            router.push(`${AuthRoutes.login}?role=admin`);
          }
          return;
        }

        // New user (no token in payload): go to verify email, carrying email and role in query param
        const email =
          typedResponse?.email ||
          typedResponse?.data?.email ||
          formInstance.getValues("email") ||
          "";

        const role = params?.role || "admin"; // Default to admin for new users

        if (email) {
          const encoded = encodeURIComponent(email);
          router.push(`${AuthRoutes.verifyEmail}?email=${encoded}&role=${role}`);
        } else {
          router.push(`${AuthRoutes.verifyEmail}?role=${role}`);
        }
      },
    },
  });

  const { mutateAsync: acceptInviteAsync, isPending: isAcceptInvitePending } = useMutationService({
    service: authServices.acceptInvitation,
    options: {
      successTitle: "Invitation accepted!",
      successMessage: "You can now log in to your account.",
      errorTitle: "Failed to accept invitation",
      isFormData: false,
      onSuccess: () => {
        if (typeof window !== "undefined" && window.location.pathname.includes("/system-admin")) {
          router.push("/system-admin/login");
        } else {
          router.push(`${AuthRoutes.login}?role=admin`);
        }
      },
    },
  });

  const onValidSubmit = async (formValues: RegisterFormValues) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmPassword, phone, ...payload } = formValues;

    const isSystemAdminFlow = typeof window !== "undefined" && window.location.pathname.includes("/system-admin");

    if (params?.token && isSystemAdminFlow) {
      await acceptInviteAsync({
        token: params.token,
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        password: payload.password,
      } as unknown as never);
    } else {
      const registrationPayload: {
        email: string;
        firstName: string;
        lastName: string;
        password: string;
        role: string;
      } = {
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        password: payload.password,
        role: params?.role || payload.role || "admin",
        ...(params?.token ? { invitationToken: params.token } : {}),
      };

      await registerAsync(registrationPayload as unknown as never);
    }
  };

  const onInvalidSubmit = () => {
    console.log("Validation errors occurred");
  };

  const isPending = isRegisterPending || isAcceptInvitePending;

  return {
    control,
    handleSubmit: handleSubmit(onValidSubmit, onInvalidSubmit),
    isPending,
    router,
  };
}
