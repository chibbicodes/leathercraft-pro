const BASE = '/api';

async function request(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
}

export const api = {
  getSettings: () => request('/settings'),
  updateSettings: (data) => request('/settings', { method: 'PUT', body: data }),
  uploadLogo: (dataUrl) => request('/logo', { method: 'POST', body: { dataUrl } }),

  getLeather: () => request('/leather'),
  addLeather: (data) => request('/leather', { method: 'POST', body: data }),
  updateLeather: (id, data) => request(`/leather/${id}`, { method: 'PUT', body: data }),
  deleteLeather: (id) => request(`/leather/${id}`, { method: 'DELETE' }),

  getHardware: () => request('/hardware'),
  addHardware: (data) => request('/hardware', { method: 'POST', body: data }),
  updateHardware: (id, data) => request(`/hardware/${id}`, { method: 'PUT', body: data }),
  deleteHardware: (id) => request(`/hardware/${id}`, { method: 'DELETE' }),

  getProcessors: () => request('/processors'),
  addProcessor: (data) => request('/processors', { method: 'POST', body: data }),
  updateProcessor: (id, data) => request(`/processors/${id}`, { method: 'PUT', body: data }),
  deleteProcessor: (id) => request(`/processors/${id}`, { method: 'DELETE' }),

  getPaymentOptions: () => request('/payment-options'),
  addPaymentOption: (data) => request('/payment-options', { method: 'POST', body: data }),
  updatePaymentOption: (id, data) => request(`/payment-options/${id}`, { method: 'PUT', body: data }),
  deletePaymentOption: (id) => request(`/payment-options/${id}`, { method: 'DELETE' }),

  getCustomers: () => request('/customers'),
  getCustomer: (id) => request(`/customers/${id}`),
  addCustomer: (data) => request('/customers', { method: 'POST', body: data }),
  updateCustomer: (id, data) => request(`/customers/${id}`, { method: 'PUT', body: data }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),

  getJobs: () => request('/jobs'),
  addJob: (data) => request('/jobs', { method: 'POST', body: data }),
  updateJob: (id, data) => request(`/jobs/${id}`, { method: 'PUT', body: data }),
  deleteJob: (id) => request(`/jobs/${id}`, { method: 'DELETE' }),

  getInvoices: () => request('/invoices'),
  getInvoice: (id) => request(`/invoices/${id}`),
  createInvoice: (data) => request('/invoices', { method: 'POST', body: data }),
  updateInvoice: (id, data) => request(`/invoices/${id}`, { method: 'PUT', body: data }),
  deleteInvoice: (id) => request(`/invoices/${id}`, { method: 'DELETE' }),
  addInvoiceItem: (id, data) => request(`/invoices/${id}/add-item`, { method: 'POST', body: data }),
  generateInvoicePdf: (id) => request(`/invoices/${id}/generate-pdf`, { method: 'POST' }),

  getDashboard: () => request('/dashboard'),
};
