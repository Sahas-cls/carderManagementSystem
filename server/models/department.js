"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Department extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Department.belongsTo(models.Factory, {
        foreignKey: "factoryId",
        as: "factory",
      });
      Department.hasMany(models.Employee, {
        foreignKey: "departmentId",
        as: "employees",
      });
    }
  }
  Department.init(
    {
      factoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "factories",
          key: "id",
        },
      },
      departmentName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Department",
      tableName: "departments",
      timestamps: true,
    },
  );
  return Department;
};
