import React from "react";
import { createRoot } from "react-dom/client";
import { Slide, Stack, Typography, Box, IconButton, Collapse } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";

interface PushToastOptions {
  title: string;
  body?: string;
  duration?: number;
  url?: string;
}

export function showPushNotificationToast({
  title,
  body,
  duration = 6000,
  url,
}: PushToastOptions) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const Toast = () => {
    const [open, setOpen] = React.useState(true);

    const handleClose = (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setOpen(false);
      setTimeout(() => {
        root.unmount();
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
      }, 300);
    };

    const handleClick = () => {
      if (url) {
        window.location.href = url;
      }
      handleClose();
    };

    React.useEffect(() => {
      const timer = setTimeout(handleClose, duration);
      return () => clearTimeout(timer);
    }, []);

    return (
      <Stack
        direction="row"
        justifyContent="flex-end"
        className="fixed top-6 right-6 z-[99999]"
      >
        <Slide direction="left" in={open} mountOnEnter unmountOnExit>
          <Collapse in={open}>
            <Box
              onClick={handleClick}
              className={`bg-white shadow-xl rounded-lg p-4 border-l-4 border-blue-main flex items-start space-x-3 w-80 max-w-full ${
                url ? "cursor-pointer hover:bg-gray-50" : ""
              } transition-colors`}
            >
              <Box className="flex-shrink-0 mt-0.5 text-blue-main">
                <NotificationsActiveIcon fontSize="small" />
              </Box>
              <Box className="flex-1 min-w-0">
                <Typography className="!text-sm !font-semibold text-gray-900 truncate">
                  {title}
                </Typography>
                {body && (
                  <Typography className="!text-xs text-gray-500 mt-1 line-clamp-2">
                    {body}
                  </Typography>
                )}
              </Box>
              <IconButton
                size="small"
                onClick={handleClose}
                className="flex-shrink-0 !p-1 -mt-1 -mr-1 text-gray-400 hover:text-gray-500"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Collapse>
        </Slide>
      </Stack>
    );
  };

  root.render(<Toast />);
}
