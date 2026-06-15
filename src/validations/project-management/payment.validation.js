const Joi = require('joi');

const createPayment = {
  params: Joi.object({ projectId: Joi.string().required() }),
  body: Joi.object({
    paymentType: Joi.string().valid('Advance', 'UOM Based').required(),
    uom: Joi.string().valid('Hour', 'Task', 'Milestone', 'Month', 'Custom').when('paymentType', {
      is: 'UOM Based',
      then: Joi.required(),
      otherwise: Joi.optional().allow(null),
    }),
    quantity: Joi.number().min(0).when('paymentType', {
      is: 'UOM Based',
      then: Joi.required(),
      otherwise: Joi.optional().allow(null),
    }),
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
    paymentType: Joi.string().valid('Advance', 'UOM Based'),
    uom: Joi.string().allow(null, ''),
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

module.exports = { createPayment, updatePayment, getPayments, getPayment, deletePayment };
