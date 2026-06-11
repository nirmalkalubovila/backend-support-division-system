const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { settingService } = require('../../services');
const ApiError = require('../../utils/ApiError');

const getBranding = catchAsync(async (req, res) => {
  const branding = await settingService.getBranding();
  res.send(branding);
});

const updateBranding = catchAsync(async (req, res) => {
  const branding = await settingService.updateBranding(req.body);
  res.send(branding);
});

const uploadLogo = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Please upload an image file');
  }
  const logoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.status(httpStatus.CREATED).send({ logoUrl });
});

module.exports = {
  getBranding,
  updateBranding,
  uploadLogo,
};
