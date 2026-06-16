"use client";

import { Box, Checkbox, CircularProgress, FormControlLabel, Typography } from "@mui/material";
import { CWTextField } from "@/components/FormFields/CWTextField"; // Update import for CWTextField based on where it got copied
import { useLogin } from "./hook/useLogin";
import { Button } from "@/components/Button"; // Or updated button component path
import React from "react";
import { Controller } from "react-hook-form";
// Assuming you have this icon
import Image from "next/image";

const LoginForm = () => {
  const { control, handleSubmit, isPending } = useLogin();

  return (
    <Box
      className="w-full flex justify-center items-center h-screen bg-gray-50"
      sx={{ display: "flex", justifyContent: "center", width: "100%", height: "100vh", backgroundColor: "#f9fafb" }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-[500px] flex-col gap-5 rounded-2xl bg-white p-5 shadow-md sm:gap-6 sm:p-10"
      >
        <Box className="flex flex-col items-center justify-center mb-6">
          <Typography className="!font-bold !text-secondary-text-gray leading-[1.2] !text-2xl mb-2 text-center">
            System Admin Login
          </Typography>
          <Typography className="!text-secondary-text-gray !font-normal !text-sm text-center">
            Sign in to access the system administration portal.
          </Typography>
        </Box>

        {/* Email */}
        <CWTextField
          control={control}
          name="email"
          label="Email Address"
          placeholder="Enter your email"
          labelOnTop
          required
          fullWidth
          labelClassName="!text-sm !font-medium !text-input-gray"
          inputClasses="mt-1 !text-sm !h-10 !text-input-gray placeholder:!text-input-gray"
          className="flex-1"
        />

        {/* Password */}
        <CWTextField
          control={control}
          name="password"
          label="Password"
          type="password"
          labelOnTop
          placeholder="Enter your password"
          required
          fullWidth
          labelClassName="!text-sm !font-medium !text-input-gray"
          inputClasses="mt-1 !text-sm !h-10 !text-input-gray placeholder:!text-input-gray"
          className="flex-1"
        />

        <Controller
          control={control}
          name="keepMeLoggedIn"
          render={({ field }) => (
            <FormControlLabel
              className="!m-0"
              control={
                <Checkbox
                  checked={Boolean(field.value)}
                  onChange={(event) => field.onChange(event.target.checked)}
                  size="small"
                  sx={{
                    color: "#D0D5DD",
                    "&.Mui-checked": { color: "#008080" },
                    margin: "0px",
                    padding: "0px 16px 0px 10px",
                    width: "16px",
                    height: "16px",
                    "& .MuiTouchRipple-root": {
                      display: "none",
                    },
                  }}
                />
              }
              label={
                <Typography className="!text-xs !font-normal !text-secondary-text-gray">
                  Keep me logged in
                </Typography>
              }
            />
          )}
        />

        {/* Login Button */}
        <Button
          className="text-primary-white !rounded-lg bg-[#008080]"
          fullWidth
          type="submit"
          disabled={isPending}
          sx={{
            textTransform: "none",
            borderRadius: "8px",
            height: "48px",
            py: 1.2,
            cursor: isPending ? "not-allowed" : "pointer",
            backgroundColor: "#008080",
            color: "white",
            "&:hover": {
              backgroundColor: "#006666"
            }
          }}
        >
          {isPending ? <CircularProgress size={24} className="!text-white" /> : "Login"}
        </Button>
      </form>
    </Box>
  );
};

export default LoginForm;
