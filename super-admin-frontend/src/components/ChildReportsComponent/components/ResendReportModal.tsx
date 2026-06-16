"use client";

import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import CloseIcon from "@/modules/shared/assets/svgs/closeIcon.svg";
import { Modal } from "@/modules/shared/component/modal";
import { Button } from "@/modules/shared/component/Button";
import { useMutationService } from "@/utils/hooks/useMutationService";
import { showToast } from "@/modules/shared/component/Toast";
import {
  ResendStudentReportRequest,
  ResendStudentReportResponse,
  StudentReportDelivery,
  studentReportDynamicEndpoints,
} from "@/services/studentReport.service";

// Simple, permissive email regex — matches the validation rigor used in other parts of the app.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAILS = 50;
const MAX_MESSAGE_LENGTH = 1000;

interface ResendReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | number;
  report: StudentReportDelivery | null;
  onResendComplete?: () => void;
}

type RecipientMode = "parents" | "custom";

export const ResendReportModal: FC<ResendReportModalProps> = ({
  isOpen,
  onClose,
  studentId,
  report,
  onResendComplete,
}) => {
  const [mode, setMode] = useState<RecipientMode>("parents");
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const emailFieldRef = useRef<HTMLInputElement | null>(null);

  // Reset modal state every time it opens for a different report.
  useEffect(() => {
    if (!isOpen) return;
    setMode("parents");
    setEmails([]);
    setEmailInput("");
    setEmailError(null);
    setMessage(report?.messageNote ?? "");
  }, [isOpen, report?.id, report?.messageNote]);

  const resendEndpoint = useMemo(
    () =>
      report
        ? studentReportDynamicEndpoints.resendReport(studentId, report.id)
        : null,
    [studentId, report],
  );

  const { mutateAsync: resendAsync, isPending } = useMutationService<
    ResendStudentReportRequest,
    ResendStudentReportResponse
  >({
    service:
      resendEndpoint ??
      studentReportDynamicEndpoints.resendReport(studentId, 0),
    options: { disableToast: true },
  });

  const addEmailFromInput = (raw: string): boolean => {
    const candidates = raw
      .split(/[\s,;]+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (candidates.length === 0) return false;

    const accepted: string[] = [];
    let rejectedReason: string | null = null;

    for (const candidate of candidates) {
      if (emails.length + accepted.length >= MAX_EMAILS) {
        rejectedReason = `You can only add up to ${MAX_EMAILS} email addresses.`;
        break;
      }
      if (!EMAIL_REGEX.test(candidate)) {
        rejectedReason = `"${candidate}" is not a valid email address.`;
        continue;
      }
      const lower = candidate.toLowerCase();
      if (emails.some((existing) => existing.toLowerCase() === lower)) continue;
      if (accepted.some((existing) => existing.toLowerCase() === lower)) continue;
      accepted.push(candidate);
    }

    if (accepted.length > 0) {
      setEmails((prev) => [...prev, ...accepted]);
    }
    setEmailError(rejectedReason);
    return accepted.length > 0;
  };

  const handleEmailKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "," || event.key === " " || event.key === "Tab") {
      if (emailInput.trim()) {
        event.preventDefault();
        const added = addEmailFromInput(emailInput);
        if (added) setEmailInput("");
      }
    } else if (event.key === "Backspace" && !emailInput && emails.length > 0) {
      setEmails((prev) => prev.slice(0, -1));
    }
  };

  const handleEmailBlur = () => {
    if (emailInput.trim()) {
      const added = addEmailFromInput(emailInput);
      if (added) setEmailInput("");
    }
  };

  const handleRemoveEmail = (target: string) => {
    setEmails((prev) => prev.filter((existing) => existing !== target));
  };

  const handleSwitchMode = (next: RecipientMode) => {
    setMode(next);
    if (next === "parents") {
      setEmailError(null);
    } else {
      // Focus the email input shortly after the field appears.
      setTimeout(() => emailFieldRef.current?.focus(), 50);
    }
  };

  const messageRemaining = MAX_MESSAGE_LENGTH - message.length;
  const sendDisabled =
    isPending ||
    !report ||
    (mode === "custom" && emails.length === 0);

  const handleSend = async () => {
    if (!report) return;

    const trimmedMessage = message.trim();
    const payload: ResendStudentReportRequest = {
      recipients: mode,
      ...(mode === "custom" ? { customEmails: emails } : {}),
      ...(trimmedMessage ? { message: trimmedMessage } : {}),
    };

    try {
      const response = await resendAsync(payload);
      showToast({
        message: "Report resent",
        description: response?.message ?? "The report has been queued for delivery.",
        severity: "success",
      });
      onResendComplete?.();
      onClose();
    } catch (err) {
      const apiError = err as {
        status?: number;
        statusCode?: number;
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      const status =
        apiError?.response?.status ?? apiError?.status ?? apiError?.statusCode;
      const description =
        apiError?.response?.data?.message ??
        apiError?.message ??
        "Could not resend the report.";

      // 422 means nothing could be sent — keep the modal open so the user can adjust.
      if (status === 422) {
        showToast({
          message: "Nothing was sent",
          description,
          severity: "warning",
        });
        return;
      }

      showToast({
        message: "Failed to resend report",
        description,
        severity: "error",
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="rounded-2xl w-full max-w-[520px]"
    >
      <Box className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border-light">
        <Box>
          <Typography className="text-lg! font-semibold! text-[#101828]!">
            Resend report
          </Typography>
          {report && (
            <Typography className="text-xs! text-primary-text-light! mt-0.5!">
              #{report.id} &middot; {report.dateRangeLabel}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small" className="p-1!" aria-label="Close">
          <CloseIcon className="w-5 h-5 text-primary-text-light!" />
        </IconButton>
      </Box>

      <Box className="px-6 py-5 flex flex-col gap-5 overflow-y-auto">
        <Box className="flex flex-col gap-2">
          <Typography className="text-sm! font-medium! text-secondary-text-gray!">
            Send to
          </Typography>
          <Box className="flex flex-col gap-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="resend-recipients"
                checked={mode === "parents"}
                onChange={() => handleSwitchMode("parents")}
                className="mt-1 accent-brandColor-active"
              />
              <Box className="flex flex-col">
                <span className="text-sm font-medium text-[#101828]">Original parents</span>
                <span className="text-xs text-input-gray">
                  Send to the same parents this report was first delivered to.
                </span>
              </Box>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="resend-recipients"
                checked={mode === "custom"}
                onChange={() => handleSwitchMode("custom")}
                className="mt-1 accent-brandColor-active"
              />
              <Box className="flex flex-col">
                <span className="text-sm font-medium text-[#101828]">Custom emails</span>
                <span className="text-xs text-input-gray">
                  Enter the addresses you would like the report to go to.
                </span>
              </Box>
            </label>
          </Box>
        </Box>

        {mode === "custom" && (
          <Box className="flex flex-col gap-1.5">
            <Typography className="text-sm! font-medium! text-secondary-text-gray!">
              Recipients
            </Typography>
            <Box
              onClick={() => emailFieldRef.current?.focus()}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border-input px-3 py-2 min-h-[44px] cursor-text"
            >
              {emails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#F2F4F7] px-3 py-1 text-xs text-secondary-text-gray"
                >
                  {email}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRemoveEmail(email);
                    }}
                    className="text-primary-text-light hover:text-[#101828] cursor-pointer"
                    aria-label={`Remove ${email}`}
                  >
                    &times;
                  </button>
                </span>
              ))}
              <input
                ref={emailFieldRef}
                type="email"
                value={emailInput}
                onChange={(event) => {
                  setEmailError(null);
                  setEmailInput(event.target.value);
                }}
                onKeyDown={handleEmailKeyDown}
                onBlur={handleEmailBlur}
                placeholder={emails.length ? "" : "name@example.com"}
                className="flex-1 min-w-[140px] bg-transparent text-sm outline-none placeholder:text-input-gray"
              />
            </Box>
            <Box className="flex items-center justify-between text-xs text-input-gray">
              <span>{emailError ?? "Press Enter or comma to add an address."}</span>
              <span>
                {emails.length}/{MAX_EMAILS}
              </span>
            </Box>
          </Box>
        )}

        <Box className="flex flex-col gap-1.5">
          <Typography className="text-sm! font-medium! text-secondary-text-gray!">
            Message <span className="text-input-gray font-normal">(optional)</span>
          </Typography>
          <textarea
            value={message}
            onChange={(event) =>
              setMessage(event.target.value.slice(0, MAX_MESSAGE_LENGTH))
            }
            rows={4}
            placeholder="Add a short note for the recipients."
            className="w-full rounded-lg border border-border-input px-3 py-2 text-sm outline-none resize-y placeholder:text-input-gray focus:border-brandColor-active"
          />
          <Box className="text-right text-xs text-input-gray">
            {messageRemaining} characters left
          </Box>
        </Box>
      </Box>

      <Box className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border-light bg-white">
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={isPending}
          isRounded={false}
          className="rounded-lg! border! border-border-input! bg-white! text-secondary-text-gray! px-4! py-2! text-sm!"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSend}
          loading={isPending}
          disabled={sendDisabled}
          isRounded={false}
          className="rounded-lg! px-5! py-2! text-sm!"
        >
          Send
        </Button>
      </Box>
    </Modal>
  );
};

export default ResendReportModal;
