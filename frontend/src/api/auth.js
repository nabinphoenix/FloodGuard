import api from "./axios";

const TOKEN_KEY = "floodguard_token";

export async function register(userData) {
  const response = await api.post("/auth/register", userData);

  if (response.data?.access_token) {
    localStorage.setItem(TOKEN_KEY, response.data.access_token);
  }

  return response.data;
}

export async function login(email, password) {
  const response = await api.post("/auth/login", { email, password });

  if (response.data?.access_token) {
    localStorage.setItem(TOKEN_KEY, response.data.access_token);
  }

  return response.data;
}

export async function getMe() {
  const response = await api.get("/auth/me");
  return response.data;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function updateProfile(data) {
  const response = await api.put("/auth/profile", data);
  return response.data;
}

export async function checkPasswordRecoveryStatus() {
  const response = await api.post("/auth/password-recovery/check-status");
  return response.data;
}

export async function forgotPassword(email) {
  const response = await api.post("/auth/forgot-password", { email });
  return response.data;
}

export async function resetPassword(token, newPassword) {
  const response = await api.post("/auth/reset-password", {
    token,
    new_password: newPassword,
  });
  return response.data;
}
