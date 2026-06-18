/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useState } from "react";
import dayjs from "dayjs";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import CalendarIcon from "@/modules/shared/assets/svgs/calendarLinear.svg";
import { CWTextField } from "@/modules/shared/component/FormFields/CWTextField";
import { CWTextArea } from "@/modules/shared/component/FormFields/CWTextArea";
import { CWDropdown } from "@/modules/shared/component/FormFields/CWDropdown";
import { type DropdownOption } from "@/modules/shared/component/Dropdown";
import AddIcon from "@mui/icons-material/Add";
import { Controller } from "react-hook-form";
import { Box, Typography } from "@mui/material";
import { TextField } from "@/modules/shared/component/TextField";
import Dropzone from "react-dropzone";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { IconButton, CircularProgress } from "@mui/material";
import type { SendOfferChild, SendOfferItem, SendOfferAttachment } from "../../page/LeadsAndRequests/hooks/useSendOffer";
import { formatAmount } from "@/utils/hooks/formatNumber";
import { useMediaQuery } from "@/utils/hooks/useMediaQuery";
import { MobileFormDrawer } from "@/modules/shared/component/MobileFormDrawer/MobileFormDrawer";
import ScrollableTabBar from "@/layout/Shared/ScrollableTabBar";
import ProfileTab from "../../page/Children/tabs/ProfileTab";
import { ParentTab } from "../../page/Children/tabs/ParentTab";

interface SendOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroomOptions: DropdownOption<number>[];
  isLoadingClassrooms?: boolean;
  control: any;
  items: any[];
  addRow: () => void;
  removeRow: (index: number) => void;
  updateItem: (index: number, field: keyof SendOfferItem, value: string | number) => void;
  childrenData: SendOfferChild[];
  addChild: () => void;
  removeChild: (index: number) => void;
  onSubmit: (e?: React.BaseSyntheticEvent) => void;
  errors?: any;
  trigger?: any;
  generateEmailContent?: () => void;
  emailAttachments?: SendOfferAttachment[];
  onAddAttachment?: (file: File) => void;
  onRemoveAttachment?: (index: number) => void;
  isSendingOffer?: boolean;
  isUploadingDocuments?: boolean;
  derivedData?: any;
}

const labelClass = "!text-sm !font-medium  !text-[#022F2F]";
const inputClasses = "mt-1 !text-sm !h-10 !text-[#022F2F]";

const sanitizeDecimalInput = (value: string, maxDecimalPlaces = 2) => {
  const cleaned = value.replace(/[^0-9.]/g, "").replace(/(\..*)\./, "$1");
  const [whole, decimal] = cleaned.split(".");
  if (decimal == null) return whole;
  return `${whole}.${decimal.slice(0, maxDecimalPlaces)}`;
};

const formatCurrencyWhileTyping = (value: string, maxDecimalPlaces = 2) => {
  const sanitized = sanitizeDecimalInput(value, maxDecimalPlaces);
  if (!sanitized) return "";
  const hasTrailingDot = sanitized.endsWith(".");
  const [wholePart, decimalPart = ""] = sanitized.split(".");
  const formattedWhole = formatAmount(wholePart || "0", 0);
  if (hasTrailingDot) return `${formattedWhole}.`;
  if (sanitized.includes(".")) return `${formattedWhole}.${decimalPart}`;
  return formattedWhole;
};

const getLineAmount = (item: { quantity: string | number; rate: string | number }) => {
  const q = Number(item.quantity) || 0;
  const r = Number(String(item.rate).replace(/,/g, "")) || 0;
  return q * r;
};

const getLineVat = (item: { quantity: string | number; rate: string | number; vat?: string | number }) => {
  const lineAmt = getLineAmount(item);
  const vatPct = Number(item.vat) || 0;
  return (lineAmt * vatPct) / 100;
};

const SendOfferModal: React.FC<SendOfferModalProps> = ({
  isOpen,
  onClose,
  classroomOptions,
  isLoadingClassrooms = false,
  control,
  items,
  addRow,
  removeRow,
  updateItem,
  childrenData,
  addChild,
  removeChild,
  onSubmit,
  trigger,
  generateEmailContent,
  emailAttachments,
  onAddAttachment,
  onRemoveAttachment,
  isSendingOffer = false,
  isUploadingDocuments = false,
  derivedData,
}) => {
  const isMobile = useMediaQuery("(max-width:768px)");
  const [openDatePickerIndex, setOpenDatePickerIndex] = useState<number | null>(null);
  const tabsList = ["profile", "parent", "documents", "invoice", "email"] as const;
  type TabType = typeof tabsList[number];
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab("profile");
    }
  }, [isOpen]);

  const handleNext = async () => {
    if (["profile", "parent", "documents"].includes(activeTab)) {
      const isValid = await trigger?.(["parentFirstName", "parentLastName", "children"]);
      if (!isValid) return;
      
      if (activeTab === "profile") setActiveTab("parent");
      else if (activeTab === "parent") setActiveTab("documents");
      else if (activeTab === "documents") setActiveTab("invoice");
    } else if (activeTab === "invoice") {
      const isValid = await trigger?.(["items", "paymentMethod"]);
      if (isValid) {
        generateEmailContent?.();
        setActiveTab("email");
      }
    }
  };

  const handleBack = () => {
    if (activeTab === "email") setActiveTab("invoice");
    else if (activeTab === "invoice") setActiveTab("documents");
    else if (activeTab === "documents") setActiveTab("parent");
    else if (activeTab === "parent") setActiveTab("profile");
  };

  const handleTabClick = async (tabId: TabType) => {
    if (tabId === "email") {
      generateEmailContent?.();
    }
    setActiveTab(tabId);
  }

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach((file) => {
        onAddAttachment?.(file);
      });
    },
    [onAddAttachment],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const subtotal = items.reduce((sum, i) => sum + getLineAmount(i), 0);
  const vatTotal = items.reduce((sum, i) => sum + getLineVat(i), 0);
  const total = subtotal + vatTotal;

  if (!isOpen) return null;

  const content = (
    <div
      className={`space-y-8 overflow-y-auto ${isMobile ? "py-4 pb-32" : "py-4"}`}
      style={!isMobile ? { maxHeight: "calc(85vh - 100px)", minHeight: "150px" } : undefined}
    >
      <div className="space-y-6">
        <ScrollableTabBar className="border-b border-border-lightGray">
          {[
            { id: "profile", label: "Profile" },
            { id: "parent", label: "Parent" },
            { id: "documents", label: "Documents" },
            { id: "invoice", label: "Invoice" },
            { id: "email", label: "Email" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={`shrink-0 whitespace-nowrap !text-sm !font-normal pb-2 px-3 ${
                activeTab === t.id
                  ? "!text-brandColor-active border-b !font-medium !border-brandColor-active"
                  : "text-gray-500"
              }`}
              onClick={() => handleTabClick(t.id as any)}
            >
              {t.label}
            </button>
          ))}
        </ScrollableTabBar>

          {activeTab === "profile" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#022F2F]">Child Details</h3>
                <button
                  type="button"
                  onClick={addChild}
                  className="text-sm flex items-center cursor-pointer gap-1 font-medium text-[#008080] hover:text-[#006666]"
                >
                  <AddIcon fontSize="small" /> Add New Child
                </button>
              </div>

              {childrenData.map((child, index) => (
                <div key={child.id || index} className="space-y-6 relative border p-4 rounded-xl border-gray-200">
                  {childrenData.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeChild(index)}
                      className="absolute top-4 right-4 cursor-pointer p-1 text-[#F04438] hover:bg-red-50 rounded"
                      aria-label="Remove child"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </button>
                  )}

                  {childrenData.length > 1 && (
                    <h4 className="text-sm font-semibold text-[#022F2F]">Child {index + 1}</h4>
                  )}

                  <ProfileTab
                    control={control}
                    handleImageUpload={() => {}}
                    selectedImage={null}
                    prefix={`children.${index}.`}
                    hideEmergency
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === "parent" && (
            <div className="space-y-4">
              <ParentTab
                control={control}
                handleImageUpload={() => {}}
                selectedImage={null}
                parents={control._formValues?.parents || []}
                addParent={() => {
                  const currentParents = control._formValues?.parents || [];
                  const newParent = { title: "", firstName: "", lastName: "", relationship: "", phone: "", email: "", address: "" };
                  control._formValues.parents = [...currentParents, newParent];
                }}
                removeParent={(index: number) => {
                  const currentParents = control._formValues?.parents || [];
                  const updatedParents = currentParents.filter((_: any, i: number) => i !== index);
                  control._formValues.parents = updatedParents;
                }}
              />
            </div>
          )}

          {activeTab === "documents" && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[#022F2F]">Documents</h3>
              <p className="text-sm text-gray-500">Documents submitted during admission are available below.</p>
              
              <div className="space-y-3">
                {derivedData?.birthCertificate ? (
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <span className="text-sm font-medium">Birth Certificate</span>
                    <a 
                      href={derivedData.birthCertificate} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-[#008080] hover:underline"
                    >
                      View
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No Birth Certificate provided.</p>
                )}

                {derivedData?.immunizationRecord ? (
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <span className="text-sm font-medium">Immunization Record</span>
                    <a 
                      href={derivedData.immunizationRecord} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-[#008080] hover:underline"
                    >
                      View
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No Immunization Record provided.</p>
                )}
              </div>
            </div>
          )}
        </div>
        {activeTab === "invoice" && (
      <>
      {/* Items Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#022F2F]">Items</h3>
          <button
            type="button"
            onClick={addRow}
            className="text-sm flex items-center cursor-pointer gap-1 font-medium text-[#008080] hover:text-[#006666]"
          >
            <AddIcon fontSize="small" /> Add New Row
          </button>
        </div>

        {!isMobile && (
          <>
            <div className="flex gap-3 items-center text-xs text-[#475467] font-medium border-b border-[#0250504D] pb-2">
              <div className="flex-1 min-w-[140px]">Description</div>
              <div className="w-20 text-center">Qty</div>
              <div className="w-28 text-center">Rate</div>
              <div className="w-20 text-center">VAT</div>
              <div className="w-28 text-center">Amount</div>
              <div className="w-8" />
            </div>

            <Controller
              name="items"
              control={control}
              render={({ field: { value } }) => (
                <>
                  {(value ?? []).map((item: any, index: number) => (
                    <div key={item?.id || index} className="flex gap-3 items-start">
                      <div className="flex-1 min-w-[140px]">
                        <CWTextField
                          control={control}
                          name={`items.${index}.description`}
                          placeholder="Enter description..."
                          inputClasses="!h-10 !text-sm"
                          className="w-full"
                        />
                      </div>
                      <div className="w-20">
                        <CWTextField
                          control={control}
                          name={`items.${index}.quantity`}
                          placeholder="0"
                          inputClasses="!h-10 !text-sm"
                          className="w-full"
                          onChangeCapture={(e: any) => {
                            const v = e?.target?.value?.replace?.(/[\D]/g, "") ?? "";
                            updateItem(index, "quantity", v);
                          }}
                        />
                      </div>
                      <div className="w-28">
                        <Controller
                          name={`items.${index}.rate`}
                          control={control}
                          render={({ field: { value: rateVal, onChange, onBlur }, fieldState: { error } }) => (
                            <TextField
                              size="small"
                              placeholder="0.00"
                              value={rateVal ?? ""}
                              inputMode="decimal"
                              className="!w-full"
                              inputClasses="!h-10 !text-sm"
                              errorText={error?.message}
                              onChange={(e) => {
                                const formatted = formatCurrencyWhileTyping(e.target.value, 2);
                                onChange(formatted);
                              }}
                              onBlur={(e) => {
                                const num = Number(String(e.target.value).replace(/,/g, "")) || 0;
                                if (e.target.value.trim() !== "") {
                                  onChange(formatAmount(num, 2));
                                }
                                onBlur();
                              }}
                              onFocus={(e) => e.target.select()}
                            />
                          )}
                        />
                      </div>
                      <div className="w-20">
                        <Controller
                          name={`items.${index}.vat`}
                          control={control}
                          render={({ field: { value: vatVal, onChange, onBlur }, fieldState: { error } }) => (
                            <TextField
                              size="small"
                              placeholder="0"
                              value={vatVal ?? ""}
                              inputMode="decimal"
                              className="!w-full"
                              inputClasses="!h-10 !text-sm"
                              startIcon={<span>%</span>}
                              errorText={error?.message}
                              onChange={(e) => {
                                const sanitized = sanitizeDecimalInput(e.target.value, 1);
                                if (!sanitized) {
                                  onChange("");
                                  return;
                                }
                                const numeric = Number(sanitized);
                                if (Number.isNaN(numeric) || numeric > 100) return;
                                onChange(sanitized);
                              }}
                              onBlur={() => {
                                const sanitized = sanitizeDecimalInput(String(vatVal ?? ""), 1);
                                if (!sanitized) {
                                  onChange(0);
                                  onBlur();
                                  return;
                                }
                                onChange(Number(sanitized).toFixed(1));
                                onBlur();
                              }}
                              onFocus={(e) => e.target.select()}
                            />
                          )}
                        />
                      </div>
                      <div className="w-28">
                        <TextField
                          size="small"
                          value={formatAmount(getLineAmount(items[index] ?? item), 2)}
                          disabled
                          className="!w-full"
                          inputClasses="!h-10 !text-sm"
                        />
                      </div>
                      <div className="w-8 flex justify-center">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="p-1 text-[#F04438] hover:bg-red-50 rounded"
                          aria-label="Delete row"
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            />
          </>
        )}

        {isMobile && (
          <div className="md:hidden flex flex-col gap-3">
            {items.map((item, index) => (
              <div
                key={item?.id || index}
                className="rounded-xl border border-gray-200 bg-white/80 p-3 sm:p-4 flex flex-col gap-3"
              >
                <div className="flex flex-col gap-1.5 w-full">
                  <Typography className="!text-xs !text-input-gray">Description</Typography>
                  <CWTextField
                    control={control}
                    name={`items.${index}.description`}
                    placeholder="Enter here"
                    inputClasses="!h-10 !text-sm"
                    className="w-full"
                    labelClassName="!sr-only"
                  />
                </div>
                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5 w-full">
                    <Typography className="!text-xs !text-input-gray">Quantity</Typography>
                    <CWTextField
                      control={control}
                      name={`items.${index}.quantity`}
                      placeholder="0"
                      inputClasses="!h-10 !text-sm"
                      className="w-full"
                      labelClassName="!sr-only"
                      onChangeCapture={(e: any) => {
                        const v = e?.target?.value?.replace?.(/[\D]/g, "") ?? "";
                        updateItem(index, "quantity", v);
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 w-full">
                    <Typography className="!text-xs !text-input-gray">Rate</Typography>
                    <Controller
                      name={`items.${index}.rate`}
                      control={control}
                      render={({ field: { value: rateVal, onChange, onBlur } }) => (
                        <TextField
                          size="small"
                          placeholder="0.00"
                          value={rateVal ?? ""}
                          inputMode="decimal"
                          className="!w-full"
                          inputClasses="!h-10 !text-sm"
                          onChange={(e) => {
                            const formatted = formatCurrencyWhileTyping(e.target.value, 2);
                            onChange(formatted);
                          }}
                          onBlur={(e) => {
                            const num = Number(String(e.target.value).replace(/,/g, "")) || 0;
                            if (e.target.value.trim() !== "") onChange(formatAmount(num, 2));
                            onBlur();
                          }}
                          onFocus={(e) => e.target.select()}
                        />
                      )}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5 w-full">
                    <Typography className="!text-xs !text-input-gray">VAT</Typography>
                    <Controller
                      name={`items.${index}.vat`}
                      control={control}
                      render={({ field: { value: vatVal, onChange, onBlur } }) => (
                        <TextField
                          size="small"
                          placeholder="0"
                          value={vatVal ?? ""}
                          inputMode="decimal"
                          className="!w-full"
                          inputClasses="!h-10 !text-sm"
                          startIcon={<span>%</span>}
                          onChange={(e) => {
                            const sanitized = sanitizeDecimalInput(e.target.value, 1);
                            if (!sanitized) {
                              onChange("");
                              return;
                            }
                            const numeric = Number(sanitized);
                            if (Number.isNaN(numeric) || numeric > 100) return;
                            onChange(sanitized);
                          }}
                          onBlur={() => {
                            const sanitized = sanitizeDecimalInput(String(vatVal ?? ""), 1);
                            if (!sanitized) {
                              onChange(0);
                              onBlur();
                              return;
                            }
                            onChange(Number(sanitized).toFixed(1));
                            onBlur();
                          }}
                          onFocus={(e) => e.target.select()}
                        />
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 w-full">
                    <Typography className="!text-xs !text-input-gray">Amount</Typography>
                    <TextField
                      size="small"
                      value={formatAmount(getLineAmount(items[index] ?? item), 2)}
                      disabled
                      className="!w-full"
                      inputClasses="!h-10 !text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end pt-1 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="p-1 text-[#F04438] hover:bg-red-50 rounded"
                    aria-label="Delete row"
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-[#0250504D] pt-4 flex flex-col items-end gap-2 text-sm">
          <div className="flex justify-between w-full max-w-[280px]">
            <span className="text-[#667085]">Subtotal</span>
            <span className="font-medium text-[#022F2F]">₦{formatAmount(subtotal, 2)}</span>
          </div>
          <div className="flex justify-between w-full max-w-[280px]">
            <span className="text-[#667085]">Tax / VAT</span>
            <span className="font-medium text-[#022F2F]">₦{formatAmount(vatTotal, 2)}</span>
          </div>
          <div className="flex justify-between w-full max-w-[280px] pt-1 border-t border-[#0250504D]">
            <span className="font-semibold text-[#022F2F]">Total</span>
            <span className="font-semibold text-[#008080]">₦{formatAmount(total, 2)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <CWDropdown
          control={control}
          name="paymentMethod"
          options={[
            { name: "Cash", value: "cash" },
            { name: "Online Payment", value: "card" },
            { name: "Transfer", value: "transfer" },
            { name: "Cheque", value: "cheque" },
            { name: "Other", value: "other" },
          ]}
          isForm
          textFieldProps={{
            label: "Payment Method",
            labelOnTop: true,
            placeholder: "Select payment method",
            labelClassName: labelClass,
            inputClasses,
          }}
        />
      </div>

      <div className="pt-2 space-y-2">
        <CWTextArea
          control={control}
          name="notes"
          label="Notes"
          placeholder="Add any additional information, payment instructions or thank you message...."
          labelOnTop
          requiredAsterisk
          labelClassName="!text-sm !font-medium !text-input-gray"
          inputClasses="mt-1 !text-xs !px-3.5 !py-3 !text-input-gray placeholder:!text-input-gra"
          className="w-full"
        />
      </div>
      </>
      )}

      {activeTab === "email" && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-5">
              <CWTextField
                name="emailTo"
                control={control}
                fullWidth
                labelOnTop
                label="Recipient"
                size="small"
                startIcon={<Typography className="!text-[#4F4F4F] !text-xs !font-normal">To:</Typography>}
                inputClasses="!rounded-lg !font-semibold flex items-center"
                labelClassName="!text-sm !font-medium !text-input-gray"
              />

              <CWTextField
                name="emailSubject"
                control={control}
                fullWidth
                size="small"
                startIcon={<Typography className="!text-[#4F4F4F] !text-xs !font-normal">Subject:</Typography>}
                inputClasses="!rounded-lg !text-[#022F2F] !font-semibold"
              />

              <CWTextArea
                name="emailBody"
                control={control}
                fullWidth
                minRows={8}
                maxRows={12}
                placeholder="Enter message..."
                labelClassName="!text-sm !font-medium !text-input-gray"
                inputClasses="mt-1 !text-sm  !text-input-gray"
                className="!text-xs !text-[#344054] !font-normal"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Typography className="!text-sm !font-medium text-[#022F2F]">Attachments</Typography>
              <Dropzone onDrop={onDrop}>
                {({ getRootProps, getInputProps }) => (
                  <div {...getRootProps()}>
                    <input {...getInputProps()} />
                    <button
                      type="button"
                      className="text-[#008080] text-xs font-semibold bg-transparent hover:bg-[#0080800A] whitespace-nowrap"
                    >
                      + Add attachment
                    </button>
                  </div>
                )}
              </Dropzone>
            </div>

            <div className="space-y-2">
              {emailAttachments?.map((attachment, idx) => (
                <div
                  key={`${attachment.url}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[#EAECF0] p-3 bg-[#F9FAFB]"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#008080] text-white shrink-0">
                      <UploadFileIcon />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#344054] truncate">{attachment.name}</p>
                      <p className="text-xs text-[#667085] truncate">{attachment.url}</p>
                    </div>
                  </div>

                  <IconButton
                    size="small"
                    className="text-[#98A2B3] hover:text-[#F04438]"
                    onClick={() => onRemoveAttachment?.(idx)}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const footer = (
    <div className={`flex gap-3 ${isMobile ? "flex-col-reverse" : "justify-between w-full"}`}>
      <div>
         {activeTab !== "profile" && (
            <button
               type="button"
               onClick={handleBack}
               className={`px-4 py-2 text-sm font-semibold text-[#344054] bg-white border border-[#D0D5DD] rounded-lg hover:bg-gray-50 shadow-sm ${isMobile ? "w-full" : ""}`}
            >
               Back
            </button>
         )}
      </div>
      <div className={`flex gap-3 ${isMobile ? "flex-col-reverse" : "justify-end"}`}>
         <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 text-sm font-semibold text-[#344054] bg-white border border-[#D0D5DD] rounded-lg hover:bg-gray-50 shadow-sm ${isMobile ? "w-full" : ""}`}
         >
            Cancel
         </button>
         {activeTab !== "email" ? (
            <button
               type="button"
               onClick={handleNext}
               className={`px-4 py-2 text-sm font-semibold text-white bg-[#008080] rounded-lg hover:bg-[#006666] shadow-sm ${isMobile ? "w-full" : ""}`}
            >
               Next
            </button>
         ) : (
            <button
               type="button"
               onClick={onSubmit}
               disabled={isSendingOffer || isUploadingDocuments}
               className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#008080] rounded-lg hover:bg-[#006666] shadow-sm disabled:opacity-50 ${isMobile ? "w-full" : ""}`}
            >
               {(isSendingOffer || isUploadingDocuments) && <CircularProgress size={16} className="!text-white" />}
               {!(isSendingOffer || isUploadingDocuments) && "Send Offer"}
            </button>
         )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <MobileFormDrawer open={isOpen} onClose={onClose} title="Send Offer" footer={footer}>
        {content}
      </MobileFormDrawer>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="bg-white rounded-lg max-w-3xl px-6  w-full mx-4 max-h-[90vh] h-full overflw-y-auto [&::-webkit-scrollbar]:hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between  py-4  border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">Send Offer</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <CloseIcon fontSize="medium" />
          </button>
        </div>

        {content}

        <div className="flex justify-end gap-3 px-6 py-5 border-t border-[#0250504D] rounded-b-lg">
          {footer}
        </div>
      </div>
    </div>
  );
};

export default SendOfferModal;
