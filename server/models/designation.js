"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Designation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Designation.hasMany(models.Employee, {
        foreignKey: "designationId",
        as: "employees",
      });
    }
  }
  Designation.init(
    {
      designation: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Designation",
      tableName: "designations",
      timestamps: true,
    },
  );
  return Designation;
};
