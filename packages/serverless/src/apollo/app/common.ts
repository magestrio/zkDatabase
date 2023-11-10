import Joi from 'joi';

export const databaseName = Joi.string()
  .trim()
  .min(4)
  .max(128)
  .required()
  .pattern(/^[a-z]+[\_a-z0-9]+/i);

export const collectionName = Joi.string()
  .trim()
  .min(4)
  .max(128)
  .required()
  .pattern(/^[a-z]+[\_a-z0-9]+/i);

export const indexName = Joi.string()
  .trim()
  .min(2)
  .max(128)
  .required()
  .pattern(/^[\_a-z]+[\_a-z0-9]+/i);

export const indexNumber = Joi.number().required();

export const indexField = Joi.array().items(Joi.string().required());
