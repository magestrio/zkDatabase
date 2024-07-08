import GraphQLJSON from 'graphql-type-json';
import { getNextTaskId } from '../../domain/get-next-task';

export const typeDefsTask = `#graphql
scalar JSON
type Query

extend type Query {
  taskGet: String!
}
`;

const taskId = async () => getNextTaskId();

export const resolversTask = {
  JSON: GraphQLJSON,
  Query: {
    taskId,
  }
};