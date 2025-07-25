import { z } from 'zod';
import { logger } from '../utils/logger';

export class SchemaConverter {
  private refs: Map<string, any> = new Map();

  constructor(definitions?: Record<string, any>) {
    // Store definitions for $ref resolution
    if (definitions) {
      for (const [name, schema] of Object.entries(definitions)) {
        this.refs.set(`#/definitions/${name}`, schema);
        this.refs.set(`#/components/schemas/${name}`, schema);
      }
    }
  }

  // Convert OpenAPI schema to Zod schema
  convert(schema: any): z.ZodType<any> {
    if (!schema) {
      return z.any();
    }

    // Handle $ref
    if (schema.$ref) {
      const resolved = this.resolveRef(schema.$ref);
      if (resolved) {
        return this.convert(resolved);
      }
      logger.warn(`Unable to resolve $ref: ${schema.$ref}`);
      return z.any();
    }

    // Handle combined schemas
    if (schema.allOf) {
      return this.convertAllOf(schema.allOf);
    }
    if (schema.oneOf) {
      return this.convertOneOf(schema.oneOf);
    }
    if (schema.anyOf) {
      return this.convertAnyOf(schema.anyOf);
    }

    // Handle basic types
    const type = schema.type;

    switch (type) {
      case 'string':
        return this.convertString(schema);
      case 'number':
        return this.convertNumber(schema);
      case 'integer':
        return this.convertInteger(schema);
      case 'boolean':
        return z.boolean();
      case 'array':
        return this.convertArray(schema);
      case 'object':
        return this.convertObject(schema);
      case 'null':
        return z.null();
      default:
        // If no type is specified but properties exist, assume object
        if (schema.properties) {
          return this.convertObject(schema);
        }
        return z.any();
    }
  }

  private convertString(schema: any): z.ZodType<any> {
    let zodSchema = z.string();

    if (schema.format) {
      switch (schema.format) {
        case 'email':
          zodSchema = z.string().email();
          break;
        case 'uri':
        case 'url':
          zodSchema = z.string().url();
          break;
        case 'uuid':
          zodSchema = z.string().uuid();
          break;
        case 'date':
        case 'date-time':
          zodSchema = z.string().datetime();
          break;
      }
    }

    if (schema.minLength !== undefined) {
      zodSchema = zodSchema.min(schema.minLength);
    }
    if (schema.maxLength !== undefined) {
      zodSchema = zodSchema.max(schema.maxLength);
    }
    if (schema.pattern) {
      zodSchema = zodSchema.regex(new RegExp(schema.pattern));
    }
    if (schema.enum) {
      return z.enum(schema.enum);
    }

    return zodSchema;
  }

  private convertNumber(schema: any): z.ZodType<any> {
    let zodSchema = z.number();

    if (schema.minimum !== undefined) {
      zodSchema = schema.exclusiveMinimum
        ? zodSchema.gt(schema.minimum)
        : zodSchema.gte(schema.minimum);
    }
    if (schema.maximum !== undefined) {
      zodSchema = schema.exclusiveMaximum
        ? zodSchema.lt(schema.maximum)
        : zodSchema.lte(schema.maximum);
    }
    if (schema.multipleOf !== undefined) {
      zodSchema = zodSchema.multipleOf(schema.multipleOf);
    }

    return zodSchema;
  }

  private convertInteger(schema: any): z.ZodType<any> {
    let zodSchema = z.number().int();

    if (schema.minimum !== undefined) {
      zodSchema = schema.exclusiveMinimum
        ? zodSchema.gt(schema.minimum)
        : zodSchema.gte(schema.minimum);
    }
    if (schema.maximum !== undefined) {
      zodSchema = schema.exclusiveMaximum
        ? zodSchema.lt(schema.maximum)
        : zodSchema.lte(schema.maximum);
    }

    return zodSchema;
  }

  private convertArray(schema: any): z.ZodType<any> {
    const itemsSchema = schema.items ? this.convert(schema.items) : z.any();
    let zodSchema: z.ZodType<any> = z.array(itemsSchema);

    if (schema.minItems !== undefined) {
      zodSchema = (zodSchema as z.ZodArray<any>).min(schema.minItems);
    }
    if (schema.maxItems !== undefined) {
      zodSchema = (zodSchema as z.ZodArray<any>).max(schema.maxItems);
    }
    if (schema.uniqueItems) {
      // Zod doesn't have built-in unique validation, so we add a custom refinement
      // This will return a ZodEffects type, which is still a ZodType
      zodSchema = zodSchema.refine(
        (items) => new Set(items).size === items.length,
        { message: 'Array must contain unique items' },
      );
    }

    return zodSchema;
  }

  private convertObject(schema: any): z.ZodType<any> {
    const properties = schema.properties || {};
    const required = schema.required || [];
    const shape: Record<string, z.ZodType<any>> = {};

    for (const [key, propSchema] of Object.entries(properties)) {
      let zodProp = this.convert(propSchema);

      // Make property optional if not in required array
      if (!required.includes(key)) {
        zodProp = zodProp.optional();
      }

      shape[key] = zodProp;
    }

    let zodSchema: z.ZodType<any> = z.object(shape);

    // Handle additionalProperties
    if (schema.additionalProperties === true) {
      zodSchema = z.object(shape).passthrough();
    } else if (schema.additionalProperties === false) {
      zodSchema = z.object(shape).strict();
    } else if (typeof schema.additionalProperties === 'object') {
      // Zod doesn't support typed additional properties directly
      // We'll use passthrough and add a custom refinement
      const _additionalSchema = this.convert(schema.additionalProperties);
      zodSchema = z.object(shape).passthrough();
    }

    return zodSchema;
  }

  private convertAllOf(schemas: any[]): z.ZodType<any> {
    // For allOf, we need to merge all schemas
    // Zod doesn't have a direct allOf, so we use intersection
    const zodSchemas = schemas.map(s => this.convert(s));

    if (zodSchemas.length === 0) {
      return z.any();
    }
    if (zodSchemas.length === 1) {
      return zodSchemas[0];
    }

    // Use intersection for multiple schemas
    return zodSchemas.reduce((acc, schema) => z.intersection(acc, schema));
  }

  private convertOneOf(schemas: any[]): z.ZodType<any> {
    const zodSchemas = schemas.map(s => this.convert(s));

    if (zodSchemas.length === 0) {
      return z.any();
    }
    if (zodSchemas.length === 1) {
      return zodSchemas[0];
    }

    // Use discriminated union if possible, otherwise use union
    return z.union(zodSchemas as [z.ZodType<any>, z.ZodType<any>, ...z.ZodType<any>[]]);
  }

  private convertAnyOf(schemas: any[]): z.ZodType<any> {
    // anyOf is similar to oneOf in Zod context
    return this.convertOneOf(schemas);
  }

  private resolveRef(ref: string): any {
    return this.refs.get(ref);
  }
}