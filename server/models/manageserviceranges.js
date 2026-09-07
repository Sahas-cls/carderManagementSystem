"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ManageServiceRanges extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // No associations - a service range is a standalone lookup
      // (e.g. "0 years 6 months" up to some cutoff) used to bucket employees
      // by length of service.
    }
  }
  ManageServiceRanges.init(
    {
      years: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      months: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "ManageServiceRanges",
      tableName: "manageserviceranges",
      timestamps: true,
      paranoid: true,
    },
  );
  return ManageServiceRanges;
};
