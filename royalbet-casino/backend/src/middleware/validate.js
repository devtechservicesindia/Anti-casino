/**
 * middleware/validate.js
 * Joi schema validation wrapper — returns 422 with field errors on failure.
 */

/**
 * Returns an Express middleware that validates req.body against the given Joi schema.
 * @param {import('joi').Schema} schema
 */
export const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,   // collect ALL errors, not just first
    stripUnknown: true,  // remove fields not in schema
  });

  if (error) {
    const details = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message,
    }));
    return res.status(422).json({ error: 'Validation failed', details });
  }

  req.body = value; // use sanitised value
  next();
};
