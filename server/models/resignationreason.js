"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class ResignationReason extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      ResignationReason.hasMany(models.Employee, {
        foreignKey: "resignationReasonId",
        as: "employees",
      });
    }
  }
  ResignationReason.init(
    {
      resignedReason: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "ResignationReason",
      tableName: "resignationreasons",
      timestamps: true,
    },
  );
  return ResignationReason;
};
