/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useFieldArray, type FieldErrors } from "react-hook-form";
import * as yup from "yup";
import { useFormValidator } from "@/utils/hooks/useFormValidator";
import dayjs from "dayjs";
import { useQueryService } from "@/utils/hooks/useQueryService";
import { useMutationService } from "@/utils/hooks/useMutationService";
import { useInfiniteQueryService } from "@/utils/hooks/useInfiniteQueryService";
import { classroomServices } from "@/services/classroom.service";
import { scheduleTourServices, type SendOfferPayload } from "@/services/tour.service";
import { uploadServices } from "@/services/upload.service";
import { accountServices, GetDefaultBankAccountResponse } from "@/services/account.service";
import { formDynamicEndpoints, type GetFormResponseByIdResponse } from "@/services/form.service";
import type { Classroom } from "@/services/classroom.service";
import type { DropdownOption } from "@/modules/shared/component/Dropdown";
import type { LeadAndRequest } from "./useLeadsAndRequests";
import { showToast } from "@/modules/shared/component/Toast";

function extractFirstErrorMessage(errors: FieldErrors): string | undefined {
  for (const err of Object.values(errors)) {
    if (err == null) continue;
    if (typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
      return (err as { message: string }).message;
    }
    if (typeof err === "object") {
      const nested = extractFirstErrorMessage(err as FieldErrors);
      if (nested) return nested;
    }
  }
  return undefined;
}

function parseNumericFormValue(value: unknown): number {
  if (value === "" || value === null || value === undefined) return NaN;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
}

export interface SendOfferItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  vat: number;
  amount: number;
}

export interface ParentProps {
  title: string;
  firstName: string;
  lastName: string;
  relationship: string;
  phone: string;
  email: string;
  address: string;
}

export interface SendOfferChild {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  dateOfEnrolment: string;
  classroom: number | string;
  address: string;
  schedule: string[];
  allergies: string;
  medications: string;
  foodPreferences: string;
  dietRestrictions: string;
  notes: string;
  emergencyTitle: string;
  emergencyFirstName: string;
  emergencyLastName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  emergencyEmail: string;
  emergencyAddress: string;
}

export interface SendOfferFormData {
  parents: ParentProps[];
  paymentMethod: string;
  children: SendOfferChild[];
  items: SendOfferItem[];
  notes: string;
  emailTo: string;
  emailSubject: string;
  emailBody: string;
}

// SendOfferFormValues removed since SendOfferFormData is used

const sendOfferSchema = yup.object().shape({
  parents: yup.array().of(
    yup.object().shape({
      firstName: yup.string().required("Parent first name is required"),
      lastName: yup.string().required("Parent last name is required"),
    })
  ).min(1, "At least one parent is required"),
  paymentMethod: yup.string().required("Payment method is required"),
  children: yup
    .array()
    .of(
      yup.object().shape({
        firstName: yup.string().required("First name is required"),
        lastName: yup.string().required("Last name is required"),
        dateOfBirth: yup.string().required("Date of birth is required"),
        classroom: yup
          .mixed()
          .test(
            "classroom-selected",
            "Classroom is required",
            (v) => v !== undefined && v !== null && v !== "" && Number(v) !== 0,
          ),
      }),
    )
    .min(1, "At least one child is required"),
  items: yup
    .array()
    .of(
      yup.object().shape({
        description: yup.string().required("Description is required"),
        quantity: yup
          .mixed()
          .test("is-number", "Must be a number", (val) => !Number.isNaN(parseNumericFormValue(val)))
          .test("greater-than-zero", "Quantity must be greater than 0", (val) => parseNumericFormValue(val) > 0),
        rate: yup
          .mixed()
          .test("is-number", "Must be a number", (val) => !Number.isNaN(parseNumericFormValue(val)))
          .test("greater-than-zero", "Rate must be greater than 0", (val) => parseNumericFormValue(val) > 0),
        vat: yup
          .mixed()
          .test("is-number", "Must be a number", (val) => !Number.isNaN(parseNumericFormValue(val)))
          .test("min-vat", "VAT cannot be less than 0%", (val) => parseNumericFormValue(val) >= 0)
          .test("max-vat", "VAT cannot exceed 100%", (val) => parseNumericFormValue(val) <= 100),
        amount: yup
          .mixed()
          .test("is-number", "Must be a number", (val) => !Number.isNaN(parseNumericFormValue(val)))
          .test("min-amount", "Amount cannot be less than 0", (val) => parseNumericFormValue(val) >= 0),
      }),
    )
    .min(1, "At least one item is required"),
  notes: yup.string().optional(),
  emailTo: yup.string().email("Invalid email").required("Recipient email is required"),
  emailSubject: yup.string().required("Subject is required"),
  emailBody: yup.string().required("Message body is required"),
});

const defaultItem = (): SendOfferItem => ({
  id: crypto.randomUUID?.() ?? `item-${Date.now()}-${Math.random()}`,
  description: "",
  quantity: 0,
  rate: 0,
  vat: 0,
  amount: 0,
});

const defaultChild = (): SendOfferChild => ({
  id: crypto.randomUUID?.() ?? `child-${Date.now()}-${Math.random()}`,
  firstName: "",
  lastName: "",
  middleName: "",
  dateOfBirth: "",
  dateOfEnrolment: "",
  classroom: 0,
  address: "",
  schedule: [],
  allergies: "",
  medications: "",
  foodPreferences: "",
  dietRestrictions: "",
  notes: "",
  emergencyTitle: "",
  emergencyFirstName: "",
  emergencyLastName: "",
  emergencyRelationship: "",
  emergencyPhone: "",
  emergencyEmail: "",
  emergencyAddress: "",
});

export interface SendOfferAttachment {
  name: string;
  url: string;
}

export interface SendOfferEmailData {
  to: string;
  subject: string;
  body: string;
  attachments: SendOfferAttachment[];
}

export function useSendOffer(onSuccess?: () => void) {
  const { mutateAsync: sendOffer, isPending: isSendingOffer } = useMutationService({
    service: scheduleTourServices.sendOffer,
  });

  const { mutateAsync: uploadDocumentsAsync, isPending: isUploadingDocuments } = useMutationService(
    {
      service: uploadServices.uploadDocuments,
      options: { isFormData: true },
    },
  );

  const { data: defaultBankResp } = useQueryService<
    Record<string, never>,
    GetDefaultBankAccountResponse
  >({
    service: accountServices.getDefaultBankAccount,
    options: {
      keys: ["defaultBankAccount"],
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  });

  const {
    data: classroomData,
    isLoading: isLoadingClassrooms,
    hasNextPage: hasMoreClassrooms,
    fetchNextPage: fetchNextClassroomPage,
  } = useInfiniteQueryService<any, any>({
    service: {
      ...classroomServices.getAllClassrooms,
      data: { delta: 50 },
    },
  });

  const classroomOptions: DropdownOption<number>[] = useMemo(() => {
    const list: Classroom[] =
      classroomData?.pages?.flatMap((page: any) => page?.classrooms ?? page?.data ?? []) ?? [];
    return list.reduce((acc: DropdownOption<number>[], c: Classroom) => {
      const studentsInClass = Array.isArray(c.studentsCurrentClass) ? c.studentsCurrentClass.length : 0;
      const leftSlots = Math.max(0, Number(c.maximumCapacity || 0) - studentsInClass);
      const isClassFull = leftSlots === 0;
      if (!acc.some((existing) => existing.value === c.id)) {
        acc.push({
          value: c.id,
          name: `${c.classroomName} (Age ${c.minimumAge ?? ""}-${c.maximumAge ?? ""})`,
          disabled: isClassFull,
          component: (
            <div className="flex items-center justify-between gap-2 w-full">
              <span>{c.classroomName}</span>
              {isClassFull && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-200 text-gray-700 uppercase">
                  Class Full
                </span>
              )}
            </div>
          ),
        });
      }
      return acc;
    }, []);
  }, [classroomData]);


  useEffect(() => {
    if (!hasMoreClassrooms) return;
    void fetchNextClassroomPage();
  }, [hasMoreClassrooms, fetchNextClassroomPage]);

  // Modal & Lead state
  const [showSendOfferModal, setShowSendOfferModal] = useState(false);
  const [sendOfferLead, setSendOfferLead] = useState<LeadAndRequest | null>(null);
  const [emailAttachments, setEmailAttachments] = useState<SendOfferAttachment[]>([]);

  // Fetch full form response details if needed
  const { data: formResponseData } = useQueryService<
    Record<string, never>,
    GetFormResponseByIdResponse
  >({
    service: formDynamicEndpoints.getFormResponseById(
      sendOfferLead?.recordType === "form_response" ? sendOfferLead.bookingId : 0,
    ),
    options: {
      enabled: sendOfferLead?.recordType === "form_response" && !!sendOfferLead.bookingId && showSendOfferModal,
    },
  });

  // Derived Names and Form Prefill
  const derivedData = useMemo(() => {
    let parents: ParentProps[] = [{
      title: "",
      firstName: "",
      lastName: "",
      relationship: "",
      phone: "",
      email: "",
      address: "",
    }];
    let location = "";
    
    // Child info
    let childFirstName = "";
    let childLastName = "";
    let childMiddleName = "";
    let childDob = "";
    let childEnrolment = "";
    let childAddress = "";
    let childAllergies = "";
    let childMedications = "";
    let childFoodPref = "";
    let childDiet = "";
    let childNotes = "";
    
    // Emergency info
    let emergencyTitle = "";
    let emergencyFirstName = "";
    let emergencyLastName = "";
    let emergencyRelationship = "";
    let emergencyPhone = "";
    let emergencyEmail = "";
    let emergencyAddress = "";
    
    // Documents
    let birthCertificate = "";
    let immunizationRecord = "";

    if (sendOfferLead?.recordType === "form_response" && formResponseData?.response?.formResponseItems) {
      const responses = formResponseData.response.formResponseItems;
      const findResponse = (keyword: string) => {
        const item = responses.find((r: any) => r.formItem?.title?.toLowerCase().includes(keyword));
        return item?.selectedOption?.label || item?.value || "";
      };

      parents[0] = {
        title: findResponse("parent title"),
        firstName: findResponse("parent first name"),
        lastName: findResponse("parent last name"),
        relationship: findResponse("parent relationship"),
        phone: findResponse("parent phone"),
        email: findResponse("parent email"),
        address: findResponse("parent address"),
      };

      childFirstName = findResponse("child first name");
      childLastName = findResponse("child last name");
      childMiddleName = findResponse("child middle name");
      childAddress = findResponse("child address");
      childAllergies = findResponse("allergies");
      childMedications = findResponse("medications");
      childFoodPref = findResponse("food preferences");
      childDiet = findResponse("diet restrictions");
      childNotes = findResponse("medical notes");
      
      emergencyTitle = findResponse("emergency contact title");
      emergencyFirstName = findResponse("emergency contact first name");
      emergencyLastName = findResponse("emergency contact last name");
      emergencyRelationship = findResponse("emergency contact relationship");
      emergencyPhone = findResponse("emergency contact phone");
      emergencyEmail = findResponse("emergency contact email");
      emergencyAddress = findResponse("emergency contact address");
      
      birthCertificate = findResponse("birth certificate");
      immunizationRecord = findResponse("immunization record");

      const dobRes = findResponse("date of birth");
      if (dobRes) {
         if (dobRes.includes("-")) {
            const parts = dobRes.split("-");
            childDob = (parts.length === 3 && parts[0].length === 4) ? `${parts[2]}/${parts[1]}/${parts[0]}` : dobRes;
         } else {
            childDob = dobRes;
         }
      }

      const enrolRes = findResponse("date of enrolment");
      if (enrolRes) {
         if (enrolRes.includes("-")) {
            const parts = enrolRes.split("-");
            childEnrolment = (parts.length === 3 && parts[0].length === 4) ? `${parts[2]}/${parts[1]}/${parts[0]}` : enrolRes;
         } else {
            childEnrolment = enrolRes;
         }
      }

    } else {
      const firstParentName = sendOfferLead?.parents?.split(",")[0]?.trim() || "";
      location = sendOfferLead?.booking?.tourEvent?.location || "";
      const titles = ["mr", "mrs", "ms", "miss", "dr", "prof"];
      const nameParts = firstParentName
        .split(/\s+/)
        .filter((part) => !titles.includes(part.toLowerCase().replace(".", "")));

      parents[0].firstName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0] || "";
      parents[0].lastName = nameParts.length > 1 ? nameParts[0] : "";
    }

    return { 
      parents, location, childFirstName, childLastName, childMiddleName, childDob, childEnrolment, childAddress,
      childAllergies, childMedications, childFoodPref, childDiet, childNotes,
      emergencyTitle, emergencyFirstName, emergencyLastName, emergencyRelationship, emergencyPhone, emergencyEmail, emergencyAddress,
      birthCertificate, immunizationRecord
    };
  }, [sendOfferLead, formResponseData]);

  // Form logic
  const {
    control,
    reset,
    getValues,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useFormValidator<SendOfferFormData>({
    validationSchema: sendOfferSchema as any,
    defaultValues: {
      parents: [{
        title: "",
        firstName: "",
        lastName: "",
        relationship: "",
        phone: "",
        email: "",
        address: ""
      }],
      paymentMethod: "transfer",
      children: [defaultChild()],
      items: [defaultItem()],
      notes: "",
      emailTo: "",
      emailSubject: "",
      emailBody: "",
    },
  });

  const {
    fields: childrenFields,
    append: addChildField,
    remove: removeChildField,
  } = useFieldArray({
    control,
    name: "children",
  });

  const {
    fields: itemsFields,
    append: addItemField,
    remove: removeItemField,
  } = useFieldArray({
    control,
    name: "items",
  });

  const children = watch("children") || [];
  const items = watch("items") || [];

  const openSendOfferModal = useCallback((lead: LeadAndRequest) => {
    setSendOfferLead(lead);
    setShowSendOfferModal(true);
    setEmailAttachments([]);
  }, []);

  const closeSendOfferModal = useCallback(() => {
    setShowSendOfferModal(false);
    setTimeout(() => {
      setSendOfferLead(null);
      setEmailAttachments([]);
    }, 300);
  }, []);

  const addAttachment = useCallback(
    async (file: File) => {
      try {
        const formData = new FormData();
        formData.append("documents", file);
        formData.append("folder", "offers");

        const response = (await uploadDocumentsAsync(formData)) as {
          files?: { fileName: string; url: string }[];
        };

        const uploadedUrl = response?.files?.[0]?.url;

        if (uploadedUrl) {
          setEmailAttachments((prev) => [
            ...prev,
            { name: file.name, url: uploadedUrl },
          ]);
        }
      } catch (error: any) {
        showToast({
          message: "Failed to upload attachment",
          description: (error as any).error.message,
          severity: "error",
        });
      }
    },
    [uploadDocumentsAsync],
  );

  const removeAttachment = useCallback((index: number) => {
    setEmailAttachments((prev) => {
      const newAttachments = [...prev];
      newAttachments.splice(index, 1);
      return newAttachments;
    });
  }, []);

  // Sync form with lead data when modal opens
  useEffect(() => {
    if (showSendOfferModal) {
      reset({
        parents: derivedData.parents,
        paymentMethod: "transfer",
        notes: "",
        children: [{
           ...defaultChild(),
           firstName: derivedData.childFirstName,
           lastName: derivedData.childLastName,
           middleName: derivedData.childMiddleName,
           dateOfBirth: derivedData.childDob,
           dateOfEnrolment: derivedData.childEnrolment,
           address: derivedData.childAddress,
           allergies: derivedData.childAllergies,
           medications: derivedData.childMedications,
           foodPreferences: derivedData.childFoodPref,
           dietRestrictions: derivedData.childDiet,
           notes: derivedData.childNotes,
           emergencyTitle: derivedData.emergencyTitle,
           emergencyFirstName: derivedData.emergencyFirstName,
           emergencyLastName: derivedData.emergencyLastName,
           emergencyRelationship: derivedData.emergencyRelationship,
           emergencyPhone: derivedData.emergencyPhone,
           emergencyEmail: derivedData.emergencyEmail,
           emergencyAddress: derivedData.emergencyAddress,
        }],
        items: [defaultItem()],
        emailTo: "",
        emailSubject: "",
        emailBody: "",
      });
    }
  }, [showSendOfferModal, derivedData, reset]);

  const addRow = useCallback(() => {
    addItemField(defaultItem());
  }, [addItemField]);

  const removeRow = useCallback(
    (index: number) => {
      if (itemsFields.length > 1) {
        removeItemField(index);
      }
    },
    [itemsFields.length, removeItemField],
  );

  const updateItem = useCallback(
    (index: number, field: keyof SendOfferItem, value: string | number) => {
      const currentItems = getValues("items");
      const item = currentItems[index];
      if (!item) return;

      const updatedItem = { ...item, [field]: value };

      // Auto-calculate amount if quantity or rate changes
      if (field === "quantity" || field === "rate") {
        updatedItem.amount = Number(updatedItem.quantity || 0) * Number(updatedItem.rate || 0);
      }

      setValue(`items.${index}`, updatedItem, { shouldValidate: true });
    },
    [getValues, setValue],
  );

  const addChild = useCallback(() => {
    addChildField(defaultChild());
  }, [addChildField]);

  const removeChild = useCallback(
    (index: number) => {
      if (childrenFields.length > 1) {
        removeChildField(index);
      }
    },
    [childrenFields.length, removeChildField],
  );

  const updateChild = useCallback(
    (index: number, field: keyof SendOfferChild, value: string | number) => {
      const currentChildren = getValues("children");
      const child = currentChildren[index];
      if (!child) return;

      setValue(`children.${index}.${field}` as any, value, { shouldValidate: true });
    },
    [getValues, setValue],
  );

  const generateEmailContent = useCallback(() => {
    const formValues = getValues();
    const parentEmail = sendOfferLead?.booking?.email || (sendOfferLead as any)?.email || "";
    
    // We can assume at least one child is present if validation passed for step 1 & 2
    const childFullName =
      formValues.children && formValues.children.length > 0
        ? `${formValues.children[0].firstName} ${formValues.children[0].lastName}`.trim()
        : "Noah Johnson";

    const location = derivedData.location.trim();

    setValue("emailTo", parentEmail);
    setValue("emailSubject", location
      ? `Admission Offer from ${location} - ${childFullName}`
      : `Admission offer - ${childFullName}`
    );
    setValue("emailBody", `Dear Sir/Madam,\n\nPlease find attached the admission offer and invoice for ${childFullName}${location ? ` from ${location}` : ""} for your review and necessary action.\n\nThank you.\n\nKind regards,\nFinance Team${location ? `\n${location}` : ""}`);
  }, [sendOfferLead, derivedData, getValues, setValue]);

  const onInvalidSubmit = useCallback((validationErrors: FieldErrors<SendOfferFormData>) => {
    const msg =
      extractFirstErrorMessage(validationErrors) ??
      "Fill in all required fields before generating the email.";
    showToast({
      message: "Form incomplete",
      description: msg,
      severity: "error",
      duration: 5000,
    });
  }, []);

  const handleSendFinalOffer = useCallback(
    async (formValues: SendOfferFormData) => {
      if (!sendOfferLead?.bookingId) {
        console.error("No booking ID found");
        return;
      }

      const bankAccountId = defaultBankResp?.bankAccount?.id;

      const basePayload = {
        parent: {
          title: formValues.parents?.[0]?.title,
          firstName: formValues.parents?.[0]?.firstName || "",
          lastName: formValues.parents?.[0]?.lastName || "",
          relationship: formValues.parents?.[0]?.relationship,
          phone: formValues.parents?.[0]?.phone,
          email: formValues.parents?.[0]?.email,
          address: formValues.parents?.[0]?.address,
        },
        students: formValues.children.map((child) => ({
          firstName: child.firstName,
          lastName: child.lastName,
          middleName: child.middleName,
          classroomId: child.classroom,
          dateOfBirth: child.dateOfBirth
            ? dayjs(child.dateOfBirth, "DD/MM/YYYY").format("YYYY-MM-DD")
            : "",
          dateOfEnrolment: child.dateOfEnrolment,
          address: child.address,
          schedule: child.schedule,
          allergies: child.allergies,
          medications: child.medications,
          foodPreferences: child.foodPreferences,
          dietRestrictions: child.dietRestrictions,
          notes: child.notes,
          emergencyTitle: child.emergencyTitle,
          emergencyFirstName: child.emergencyFirstName,
          emergencyLastName: child.emergencyLastName,
          emergencyRelationship: child.emergencyRelationship,
          emergencyPhone: child.emergencyPhone,
          emergencyEmail: child.emergencyEmail,
          emergencyAddress: child.emergencyAddress,
          documents: [
            ...(derivedData.childBirthCert ? [{ type: "Birth Certificate", url: derivedData.childBirthCert, originalName: "birth_certificate" }] : []),
            ...(derivedData.childImmunization ? [{ type: "Immunization Record", url: derivedData.childImmunization, originalName: "immunization_record" }] : []),
          ],
        })),
        items: formValues.items.map((item) => ({
          description: item.description,
          quantity: parseNumericFormValue(item.quantity),
          tax: parseNumericFormValue(item.vat) || 0,
          rate: parseNumericFormValue(item.rate),
        })),
        notes: formValues.notes,
        paymentMethod: formValues.paymentMethod,
        ...(bankAccountId ? { bankAccountId } : {}),
        email: {
          receipient: formValues.emailTo,
          subject: formValues.emailSubject,
          body: formValues.emailBody,
          attachment: emailAttachments.map((a) => a.url),
        },
      };

      const payload: SendOfferPayload =
        sendOfferLead.recordType === "form_response"
          ? { ...basePayload, formResponseId: sendOfferLead.bookingId }
          : { ...basePayload, bookedTourId: sendOfferLead.bookingId };

      try {
        await sendOffer(payload);
        onSuccess?.();
        closeSendOfferModal();
        showToast({
          message: "Offer Sent",
          description: "The admission offer has been sent successfully.",
          severity: "success",
        });
      } catch (error) {
        console.error("Failed to send offer:", error);
      }
    },
    [sendOfferLead, sendOffer, onSuccess, closeSendOfferModal, defaultBankResp?.bankAccount?.id, emailAttachments],
  );

  const submitSendOffer = useCallback(
    (e?: React.BaseSyntheticEvent) => handleSubmit(handleSendFinalOffer, onInvalidSubmit)(e),
    [handleSubmit, handleSendFinalOffer, onInvalidSubmit],
  );

  return {
    classroomOptions,
    isLoadingClassrooms,
    showSendOfferModal,
    openSendOfferModal,
    closeSendOfferModal,
    emailAttachments,
    addAttachment,
    removeAttachment,
    generateEmailContent,
    derivedData,
    // Form & Items
    control,
    items,
    addRow,
    removeRow,
    updateItem,
    // Children
    children,
    addChild,
    removeChild,
    updateChild,
    submitSendOffer,
    errors,
    trigger,
    isSendingOffer,
    isUploadingDocuments,
  };
}
