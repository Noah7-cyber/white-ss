import { useState, useCallback, useEffect } from "react";
import client from "@/utils/client";
import { systemAdminSchoolServices, SystemAdminSchool, GetAllSchoolsResponse } from "@/services/system-admin-school.service";
import { enqueueSnackbar } from "notistack";

export function useSystemAdminSchools() {
  const [schools, setSchools] = useState<SystemAdminSchool[]>([]);
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const [hasMoreSchools, setHasMoreSchools] = useState(false);
  const [currentPos, setCurrentPos] = useState(0);
  const delta = 50;

  const fetchSchools = useCallback(
    async (reset = false) => {
      try {
        setIsLoadingSchools(true);
        const pos = reset ? 0 : currentPos;

        const response = await client.request<GetAllSchoolsResponse>({
          path: `${systemAdminSchoolServices.getAllSchools.path}?pos=${pos}&delta=${delta}&sortBy=schoolName&sortOrder=ASC`,
          method: systemAdminSchoolServices.getAllSchools.method,
        });

        if (response?.data?.schools) {
          setSchools((prev) => (reset ? response.data.schools : [...prev, ...response.data.schools]));
          setHasMoreSchools(response.data.schools.length === delta);
          setCurrentPos(pos + delta);
        }
      } catch (error) {
        console.error("Failed to fetch schools", error);
        enqueueSnackbar("Failed to load schools for filter", { variant: "error" });
      } finally {
        setIsLoadingSchools(false);
      }
    },
    [currentPos]
  );

  useEffect(() => {
    fetchSchools(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMoreSchools = () => {
    if (!isLoadingSchools && hasMoreSchools) {
      fetchSchools(false);
    }
  };

  const schoolOptions = [
    { value: "", label: "All Schools" },
    ...schools.map((school) => ({
      value: String(school.id),
      label: school.schoolName,
    })),
  ];

  return {
    schools,
    schoolOptions,
    isLoadingSchools,
    hasMoreSchools,
    loadMoreSchools,
  };
}
