/**
 * Mongoose paginate plugin — adds `Model.paginate(filter, options)` static method
 */
const paginate = (schema) => {
  /**
   * @param {Object} filter - Mongo filter
   * @param {Object} options - Query options
   * @param {string} [options.sortBy] - Sort option in format: sortField:(desc|asc)
   * @param {number} [options.limit] - Maximum results per page (default 10)
   * @param {number} [options.page] - Current page (default 1)
   * @param {string} [options.populate] - Populate data fields, comma separated
   * @returns {Promise<Object>}
   */
  schema.statics.paginate = async function (filter, options) {
    let sort = {};
    if (options.sortBy) {
      const parts = options.sortBy.split(':');
      sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
    } else {
      sort = { createdAt: -1 };
    }

    const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 10;
    const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
    const skip = (page - 1) * limit;

    const countPromise = this.countDocuments(filter).exec();
    let docsPromise = this.find(filter).sort(sort).skip(skip).limit(limit);

    if (options.populate) {
      options.populate.split(',').forEach((populateOption) => {
        docsPromise = docsPromise.populate(
          populateOption
            .split('.')
            .reverse()
            .reduce((a, b) => ({ path: b, populate: a }))
        );
      });
    }

    docsPromise = docsPromise.exec();

    const [totalResults, data] = await Promise.all([countPromise, docsPromise]);
    const totalPages = Math.ceil(totalResults / limit);

    return {
      data,
      page,
      limit,
      totalPages,
      totalResults,
      currentPaginationIndex: page,
      dataPerPage: limit,
      dataCount: data.length,
    };
  };
};

module.exports = paginate;
