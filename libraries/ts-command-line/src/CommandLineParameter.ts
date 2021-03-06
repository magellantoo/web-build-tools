// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import {
  IBaseCommandLineDefinition,
  ICommandLineFlagDefinition,
  ICommandLineStringDefinition,
  ICommandLineStringListDefinition,
  ICommandLineIntegerDefinition,
  ICommandLineChoiceDefinition,
  IBaseCommandLineDefinitionWithArgument
} from './CommandLineDefinition';

/**
 * Identifies the kind of a CommandLineParameter.
 * @public
 */
export enum CommandLineParameterKind {
  /** Indicates a CommandLineChoiceParameter */
  Choice,
  /** Indicates a CommandLineFlagParameter */
  Flag,
  /** Indicates a CommandLineIntegerParameter */
  Integer,
  /** Indicates a CommandLineStringParameter */
  String,
  /** Indicates a CommandLineStringListParameter */
  StringList
}

/**
 * The base class for the various command-line parameter types.
 * @public
 */
export abstract class CommandLineParameter {
  // Example: "--do-something"
  private static _longNameRegExp: RegExp = /^-(-[a-z0-9]+)+$/;
  // Example: "-d"
  private static _shortNameRegExp: RegExp = /^-[a-zA-Z]$/;

  /**
   * A unique internal key used to retrieve the value from the parser's dictionary.
   * @internal
   */
  public _parserKey: string;

  /** {@inheritdoc IBaseCommandLineDefinition.parameterLongName} */
  public readonly longName: string;

  /** {@inheritdoc IBaseCommandLineDefinition.parameterShortName} */
  public readonly shortName: string | undefined;

  /** {@inheritdoc IBaseCommandLineDefinition.description} */
  public readonly description: string;

  /** @internal */
  constructor(definition: IBaseCommandLineDefinition) {
    if (!CommandLineParameter._longNameRegExp.test(definition.parameterLongName)) {
      throw new Error(`Invalid name: "${definition.parameterLongName}". The parameter long name must be`
        + ` lower-case and use dash delimiters (e.g. "--do-a-thing")`);
    }
    this.longName = definition.parameterLongName;

    if (definition.parameterShortName) {
      if (!CommandLineParameter._shortNameRegExp.test(definition.parameterShortName)) {
        throw new Error(`Invalid name: "${definition.parameterShortName}". The parameter short name must be`
          + ` a dash followed by a single upper-case or lower-case letter (e.g. "-a")`);
      }
    }
    this.shortName = definition.parameterShortName;
    this.description = definition.description;
  }

  /**
   * Called internally by CommandLineParameterProvider._processParsedData()
   * @internal
   */
  public abstract _setValue(data: any): void; // tslint:disable-line:no-any

  /**
   * Indicates the type of parameter.
   */
  public abstract get kind(): CommandLineParameterKind;

  /**
   * Internal usage only.  Used to report unexpected output from the argparse library.
   */
  protected reportInvalidData(data: any): never { // tslint:disable-line:no-any
    throw new Error(`Unexpected data object for parameter "${this.longName}": `
      + JSON.stringify(data));
  }
}

/**
 * The common base class for parameters types that receive an argument.
 *
 * @remarks
 * An argument is an accompanying command-line token, such as "123" in the
 * example "--max-count 123".
 * @public
 */
export abstract class CommandLineParameterWithArgument extends CommandLineParameter {
  // Matches the first character that *isn't* part of a valid upper-case argument name such as "URL_2"
  private static _invalidArgumentNameRegExp: RegExp = /[^A-Z_0-9]/;

  /** {@inheritdoc IBaseCommandLineDefinitionWithArgument.argumentName} */
  public readonly argumentName: string;

  /** @internal */
  constructor(definition: IBaseCommandLineDefinitionWithArgument) {
    super(definition);

    if (definition.argumentName === '') {
      throw new Error('The argument name cannot be an empty string. (For the default name, specify undefined.)');
    }
    if (definition.argumentName.toUpperCase() !== definition.argumentName) {
      throw new Error(`Invalid name: "${definition.argumentName}". The argument name must be all upper case.`);
    }
    const match: RegExpMatchArray | null = definition.argumentName.match(
      CommandLineParameterWithArgument._invalidArgumentNameRegExp);
    if (match) {
      throw new Error(`The argument name "${definition.argumentName}" contains an invalid character "${match[0]}".`
        + ` Only upper-case letters, numbers, and underscores are allowed.`);
    }
    this.argumentName = definition.argumentName;
  }
}

/**
 * The data type returned by {@link CommandLineParameterProvider.defineChoiceParameter}.
 * @public
 */
export class CommandLineChoiceParameter extends CommandLineParameter {
  /** {@inheritdoc ICommandLineChoiceDefinition.alternatives} */
  public readonly alternatives: ReadonlyArray<string>;

  /** {@inheritdoc ICommandLineChoiceDefinition.defaultValue} */
  public readonly defaultValue: string | undefined;

  private _value: string | undefined = undefined;

  /** @internal */
  constructor(definition: ICommandLineChoiceDefinition) {
    super(definition);

    if (definition.alternatives.length <= 1) {
      throw new Error(`When defining a choice parameter, the alternatives list must contain at least one value.`);
    }
    if (definition.defaultValue && definition.alternatives.indexOf(definition.defaultValue) === -1) {
      throw new Error(`The specified default value "${definition.defaultValue}"`
        + ` is not one of the available options: ${definition.alternatives.toString()}`);
    }

    this.alternatives = definition.alternatives;
    this.defaultValue = definition.defaultValue;
  }

  /** {@inheritdoc CommandLineParameter.kind} */
  public get kind(): CommandLineParameterKind {
    return CommandLineParameterKind.Choice;
  }

  /**
   * {@inheritdoc CommandLineParameter._setValue}
   * @internal
   */
  // tslint:disable-next-line:no-any
  public _setValue(data: any): void { // abstract
    if (data === null) {
      data = undefined;
    }
    if (data !== undefined && typeof data !== 'string') {
      this.reportInvalidData(data);
    }
    this._value = data;
  }

  /**
   * Returns the argument value for a choice parameter that was parsed from the command line.
   *
   * @remarks
   * The return value will be `undefined` if the command-line has not been parsed yet,
   * or if the parameter was omitted and has no default value.
   */
  public get value(): string | undefined {
    return this._value;
  }
}

/**
 * The data type returned by {@link CommandLineParameterProvider.defineFlagParameter}.
 * @public
 */
export class CommandLineFlagParameter extends CommandLineParameter {
  private _value: boolean = false;

  /** @internal */
  constructor(definition: ICommandLineFlagDefinition) {
    super(definition);
  }

  /** {@inheritdoc CommandLineParameter.kind} */
  public get kind(): CommandLineParameterKind {
    return CommandLineParameterKind.Flag;
  }

  /**
   * {@inheritdoc CommandLineParameter._setValue}
   * @internal
   */
  // tslint:disable-next-line:no-any
  public _setValue(data: any): void { // abstract
    if (data === null) {
      data = undefined;
    }
    if (data !== undefined && typeof data !== 'boolean') {
      this.reportInvalidData(data);
    }
    this._value = !!data;
  }

  /**
   * Returns a boolean indicating whether the parameter was included in the command line.
   *
   * @remarks
   * The return value will be false if the command-line has not been parsed yet,
   * or if the flag was not used.
   */
  public get value(): boolean {
    return this._value;
  }
}

/**
 * The data type returned by {@link CommandLineParameterProvider.defineIntegerParameter}.
 * @public
 */
export class CommandLineIntegerParameter extends CommandLineParameterWithArgument {
  private _value: number | undefined = undefined;

  /** @internal */
  constructor(definition: ICommandLineIntegerDefinition) {
    super(definition);
  }

  /** {@inheritdoc CommandLineParameter.kind} */
  public get kind(): CommandLineParameterKind {
    return CommandLineParameterKind.Integer;
  }

  /**
   * {@inheritdoc CommandLineParameter._setValue}
   * @internal
   */
  // tslint:disable-next-line:no-any
  public _setValue(data: any): void { // abstract
    if (data === null) {
      data = undefined;
    }
    if (data !== undefined && typeof data !== 'number') {
      this.reportInvalidData(data);
    }
    this._value = data;
  }

  /**
   * Returns the argument value for an integer parameter that was parsed from the command line.
   *
   * @remarks
   * The return value will be undefined if the command-line has not been parsed yet,
   * or if the parameter was omitted and has no default value.
   */
  public get value(): number | undefined {
    return this._value;
  }
}

/**
 * The data type returned by {@link CommandLineParameterProvider.defineStringParameter}.
 * @public
 */
export class CommandLineStringParameter extends CommandLineParameterWithArgument {
  private _value: string | undefined = undefined;

  /** @internal */
  constructor(definition: ICommandLineStringDefinition) {
    super(definition);
  }

  /** {@inheritdoc CommandLineParameter.kind} */
  public get kind(): CommandLineParameterKind {
    return CommandLineParameterKind.String;
  }

  /**
   * {@inheritdoc CommandLineParameter._setValue}
   * @internal
   */
  // tslint:disable-next-line:no-any
  public _setValue(data: any): void { // abstract
    if (data === null) {
      data = undefined;
    }
    if (data !== undefined && typeof data !== 'string') {
      this.reportInvalidData(data);
    }
    this._value = data;
  }

  /**
   * Returns the argument value for a string parameter that was parsed from the command line.
   *
   * @remarks
   * The return value will be undefined if the command-line has not been parsed yet,
   * or if the parameter was omitted and has no default value.
   */
  public get value(): string | undefined {
    return this._value;
  }
}

/**
 * The data type returned by {@link CommandLineParameterProvider.defineStringListParameter}.
 * @public
 */
export class CommandLineStringListParameter extends CommandLineParameterWithArgument {
  private _values: string[] = [];

  /** @internal */
  constructor(definition: ICommandLineStringListDefinition) {
    super(definition);
  }

  /** {@inheritdoc CommandLineParameter.kind} */
  public get kind(): CommandLineParameterKind {
    return CommandLineParameterKind.StringList;
  }

  /**
   * {@inheritdoc CommandLineParameter._setValue}
   * @internal
   */
  // tslint:disable-next-line:no-any
  public _setValue(data: any): void { // abstract
    if (data === null) {
      data = undefined;
    }

    if (data !== undefined) {
      if (!Array.isArray(data)) {
        this.reportInvalidData(data);
      }

      for (const arrayItem of data) {
        if (typeof(arrayItem) !== 'string') {
          this.reportInvalidData(data);
        }
      }
    }

    this._values = data || [];
  }

  /**
   * Returns the string arguments for a string list parameter that was parsed from the command line.
   *
   * @remarks
   * The array will be empty if the command-line has not been parsed yet,
   * or if the parameter was omitted and has no default value.
   */
  public get values(): ReadonlyArray<string> {
    return this._values;
  }
}
