import { gql } from "graphql-modules";

export const errorsSchema = gql`  " basic structure of error "
  interface Error {
    message: String!
  }

  " common type of errors"
  type CommonError implements Error {
    message: String!
  }`
