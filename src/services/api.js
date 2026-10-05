import axiosApi from "../setupAxios";

const unwrap = (request) => request.then((response) => response.data);

const api = {
  get: (path, config) => unwrap(axiosApi.get(path, config)),
  post: (path, body) => unwrap(axiosApi.post(path, body)),
  patch: (path, body) => unwrap(axiosApi.patch(path, body)),
  delete: (path) => unwrap(axiosApi.delete(path)),
};

export const getStore = async (partnerSlug, storeSlug) => {
  return api.get(`/stores/${partnerSlug}/${storeSlug}`);
};

export const getPartner = async (partnerSlug) => {
  return api.get(`/partners/${partnerSlug}`);
};

export default api;
