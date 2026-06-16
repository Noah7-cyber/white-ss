import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { setAccessToken, setRefreshToken, User } from "@/redux/store/slices/authSlice";
import { useAppDispatch } from "@/redux/store/hooks";
import { useMutationService } from "@/utils/hooks/useMutationService";
import { systemAdminAuthServices, LoginRequest } from "@/services/system-admin-auth.service";
import { useRouter } from "next/navigation";
import { DashboardRoutes } from "@/routes/dashboard.routes";

const loginSchema = yup.object().shape({
  email: yup.string().email("Invalid email").required("Email is required"),
  password: yup.string().required("Password is required"),
  keepMeLoggedIn: yup.boolean(),
});

type LoginFormValues = yup.InferType<typeof loginSchema>;

export function useLogin() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const { control, handleSubmit } = useForm<LoginFormValues>({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      keepMeLoggedIn: false,
    },
  });

  const { mutateAsync: loginAsync, isPending } = useMutationService({
    service: systemAdminAuthServices.login,
    options: {
      isFormData: false,
      onSuccess: (response: any) => {
        const payload = response.data || response;
        const accessToken = payload.accessToken;
        const refreshToken = payload.refreshToken;

        if (accessToken) {
          dispatch(
            setAccessToken({
              token: accessToken,
              _time_stamp: new Date().toISOString(),
            })
          );
          if (refreshToken) {
            dispatch(
              setRefreshToken({
                token: refreshToken,
                _time_stamp: new Date().toISOString(),
              })
            );
          }

          // Use the global window object to redirect instead of next/router to ensure full refresh of state if needed.
          router.push(DashboardRoutes.dashboard);
        }
      },
      onError: (error) => {
        console.error("Login failed:", error);
      },
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    const payload: LoginRequest = {
      email: data.email,
      password: data.password,
    };
    await loginAsync(payload);
  };

  return {
    control,
    handleSubmit: handleSubmit(onSubmit),
    isPending,
  };
}
