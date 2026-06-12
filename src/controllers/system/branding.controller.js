const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { brandingService } = require('../../services');

const getBranding = catchAsync(async (req, res) => {
  const branding = await brandingService.getBranding();
  res.send(branding);
});

const updateBranding = catchAsync(async (req, res) => {
  const branding = await brandingService.updateBranding(req.body);
  res.send(branding);
});

const uploadLogo = catchAsync(async (req, res) => {
  if (!req.file) {
    return res.status(httpStatus.BAD_REQUEST).send({ message: 'No file uploaded' });
  }
  const logoUrl = `/uploads/logo/${req.file.filename}`;
  res.send({ logoUrl });
});

module.exports = {
  getBranding,
  updateBranding,
  uploadLogo,
};
