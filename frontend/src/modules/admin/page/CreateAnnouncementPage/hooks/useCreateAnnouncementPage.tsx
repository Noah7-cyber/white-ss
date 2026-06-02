/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef } from "react";
import { uploadServices } from "@/services/upload.service";

import { useFormValidator } from "@/utils/hooks/useFormValidator";
import { showToast } from "@/modules/shared/component/Toast";
import { useRouter } from "next/navigation";
import { DashboardRoutes } from "@/routes/dashboard.routes";
import { AnnouncementProps, initialValue, validationSchema } from "../announcement.constant";
import { useMutationService } from "@/utils/hooks/useMutationService";
import { announcementServices } from "@/services/announcements.service";
import { useQueryService } from "@/utils/hooks/useQueryService";
import { schoolDynamicEndpoints, GetSchoolResponse } from "@/services/school.service";
import { serializeAnnouncementContent } from "@/utils/announcementContent";

const useCreateAnnouncementPage = () => {
  const formInstance = useFormValidator<AnnouncementProps>({
    validationSchema,
    defaultValues: initialValue as AnnouncementProps,
    reValidateMode: "onChange",
  });
  const router = useRouter();
  const { control, setValue, getValues } = formInstance;
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const [uploadedMedia, setUploadedMedia] = useState<{ url: string; name: string }[]>([]);
  const uploadedMediaRef = useRef(uploadedMedia);
  uploadedMediaRef.current = uploadedMedia;
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const MAX_MEDIA_ATTACHMENTS = 3;

  const { mutateAsync: uploadDocumentsAsync } = useMutationService({
    service: uploadServices.uploadDocuments,
    options: { isFormData: true, disableToast: true },
  });

  const { mutateAsync: uploadFileAsync } = useMutationService({
    service: uploadServices.uploadFile,
    options: { isFormData: true, disableToast: true },
  });

  const { mutateAsync: uploadImageAsync } = useMutationService({
    service: uploadServices.uploadImage,
    options: { isFormData: true, disableToast: true },
  });

  const removeAttachment = (index: number) => {
    setUploadedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;
    const valid = files.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    const invalidCount = files.length - valid.length;
    if (invalidCount > 0) {
      showToast({ message: "Only images and videos are allowed", severity: "warning" });
    }
    if (!valid.length) {
      e.target.value = "";
      return;
    }
    const currentCount = uploadedMediaRef.current.length;
    const remaining = Math.max(0, MAX_MEDIA_ATTACHMENTS - currentCount);
    const toAdd = valid.slice(0, remaining);
    if (toAdd.length < valid.length) {
      showToast({
        message: `Maximum ${MAX_MEDIA_ATTACHMENTS} attachments allowed`,
        severity: "warning",
      });
    }
    if (!toAdd.length) {
      e.target.value = "";
      return;
    }
    setIsUploading(true);
    try {
      const newEntries: { url: string; name: string }[] = [];
      for (const file of toAdd) {
        const isImage = file.type.startsWith("image/");
        let url = "";
        if (isImage) {
          const formData = new FormData();
          formData.append("image", file);
          formData.append("folder", "properties");
          const response: any = await uploadImageAsync(formData);
          url = response?.url ?? response?.data?.url ?? "";
        } else {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("fileType", "video");
          formData.append("folder", "properties");
          const response: any = await uploadFileAsync(formData);
          url =
            response?.url ??
            response?.data?.url ??
            response?.file?.url ??
            response?.data?.file?.url ??
            "";
        }
        if (url) newEntries.push({ url, name: file.name });
      }
      if (newEntries.length) {
        setUploadedMedia((prev) => [...prev, ...newEntries].slice(0, MAX_MEDIA_ATTACHMENTS));
        showToast({ message: "File(s) uploaded successfully", severity: "success" });
      }
    } catch {
      showToast({ message: "File upload failed", severity: "error" });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };


  const { mutateAsync, isPending } = useMutationService({
    service: announcementServices.createAnnouncement,
  });

  const { data: schoolData } = useQueryService<any, GetSchoolResponse>({
    service: schoolDynamicEndpoints.getParticularSchool(),
  });

  const persistAnnouncement = async (
    values: any,
    announcementStatus: "draft" | "published",
  ) => {
    const parsedContent = serializeAnnouncementContent(values?.content);

    await mutateAsync({
      subject: values?.title,
      content: parsedContent,
      schoolId: schoolData?.school?.id,
      announcementStatus,
      mediaUrl: uploadedMedia.map((m) => m.url).join(","),
      link: "",
    });
    showToast({
      message: "Announcement Created Successfully.",
      description:
        announcementStatus === "draft"
          ? "Your announcement was saved as a draft."
          : "You've successfully published the announcement.",
      severity: "success",
      duration: 5000,
    });
    router.push(DashboardRoutes.announcement);
  };

  const onSave = async (values: any) => {
    try {
      await persistAnnouncement(values, "published");
    } catch (error: any) {
      showToast({
        message: "Error saving announcement",
        description: error?.message,
        severity: "error",
        duration: 5000,
      });
    }
  };

  const onSaveDraft = async (values: any) => {
    setIsSavingDraft(true);
    try {
      await persistAnnouncement(values, "draft");
    } catch (error: any) {
      showToast({
        message: "Error saving draft",
        description: error?.message,
        severity: "error",
        duration: 5000,
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  return {
    ...formInstance,
    isPending,
    control,
    setValue,
    getValues,
    onSave,
    onSaveDraft,
    isSavingDraft,
    uploadedMedia,
    isUploading,
    MAX_MEDIA_ATTACHMENTS,
    removeAttachment,
    handleFileSelect,
  };
};
export default useCreateAnnouncementPage;
