const Joi = require('joi');

const createPayment = {
  params: Joi.object({ projectId: Joi.string().required() }),
  body: Joi.object({
    paymentType: Joi.string().valid('Advance', 'Project Fixed Price', 'CR Based', 'UOM Based', 'Other').required(),
    uom: Joi.string().allow(null, ''),
    month: Joi.string().allow(null, ''),
    quantity: Joi.number().min(0).allow(null),
    pricePerUnit: Joi.number().min(0).required(),
    paymentDate: Joi.date().allow(null),
    dueDate: Joi.date().allow(null),
    paymentStatus: Joi.string().valid('Pending', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'),
    paymentMethod: Joi.string().valid('Bank Transfer', 'Cash', 'Online Payment').allow(null),
    referenceNumber: Joi.string().allow(null, ''),
    partiallyPaidAmount: Joi.number().min(0).allow(null),
    notes: Joi.string().allow(null, ''),
  }),
};

const updatePayment = {
  params: Joi.object({ projectId: Joi.string().required(), paymentId: Joi.string().required() }),
  body: Joi.object({
    paymentType: Joi.string().valid('Advance', 'Project Fixed Price', 'CR Based', 'UOM Based', 'Other'),
    uom: Joi.string().allow(null, ''),
    month: Joi.string().allow(null, ''),
    quantity: Joi.number().min(0).allow(null),
    pricePerUnit: Joi.number().min(0),
    paymentDate: Joi.date().allow(null),
    dueDate: Joi.date().allow(null),
    paymentStatus: Joi.string().valid('Pending', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'),
    paymentMethod: Joi.string().valid('Bank Transfer', 'Cash', 'Online Payment').allow(null),
    referenceNumber: Joi.string().allow(null, ''),
    partiallyPaidAmount: Joi.number().min(0).allow(null),
    notes: Joi.string().allow(null, ''),
  }).min(1),
};

const getPayments = {
  params: Joi.object({ projectId: Joi.string().required() }),
};

const getPayment = {
  params: Joi.object({ projectId: Joi.string().required(), paymentId: Joi.string().required() }),
};

const deletePayment = {
  params: Joi.object({ projectId: Joi.string().required(), paymentId: Joi.string().required() }),
};

const allocatePayment = {
  params: Joi.object({ projectId: Joi.string().required(), paymentId: Joi.string().required() }),
  body: Joi.object({
    amount: Joi.number().positive().required(),
    paymentMethod: Joi.string().valid('Bank Transfer', 'Cash', 'Online Payment').allow(null),
    paymentDate: Joi.date().allow(null),
    referenceNumber: Joi.string().allow(null, ''),
    notes: Joi.string().allow(null, ''),
  }),
};

module.exports = { createPayment, updatePayment, getPayments, getPayment, deletePayment, allocatePayment };
