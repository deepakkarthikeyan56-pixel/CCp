import { toast } from "react-toastify";

const toastConfig = {
  position: "top-right",
  autoClose: 4000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: "colored",
};

export function success(message) {
  toast.success(message, {
    ...toastConfig,
    style: {
      background: "linear-gradient(135deg, #10b981, #059669)",
      color: "#fff",
      borderRadius: "12px",
    },
  });
}

export function error(message) {
  toast.error(message, {
    ...toastConfig,
    autoClose: 5000,
    style: {
      background: "linear-gradient(135deg, #ef4444, #dc2626)",
      color: "#fff",
      borderRadius: "12px",
    },
  });
}

export function info(message) {
  toast.info(message, {
    ...toastConfig,
    style: {
      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
      color: "#fff",
      borderRadius: "12px",
    },
  });
}

export function warning(message) {
  toast.warning(message, {
    ...toastConfig,
    style: {
      background: "linear-gradient(135deg, #f59e0b, #d97706)",
      color: "#fff",
      borderRadius: "12px",
    },
  });
}
