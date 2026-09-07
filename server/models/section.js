"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Section extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Section.hasMany(models.Employee, {
        foreignKey: "sectionId",
        as: "employees",
      });
    }
  }
  Section.init(
    {
      sectionName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Section",
      tableName: "sections",
      timestamps: true,
    },
  );
  return Section;
};
