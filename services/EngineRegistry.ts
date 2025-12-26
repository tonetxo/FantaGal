import { ISynthEngine } from './BaseSynthEngine';
import { SynthState } from '../types';

/**
 * Theme configuration for an engine
 */
export interface EngineTheme {
    bg: string;
    text: string;
    accent: string;
    border: string;
}

/**
 * Definition of an engine for registration
 */
export interface EngineDefinition {
    /** Unique identifier for the engine */
    name: string;

    /** Display name shown in UI */
    displayName: string;

    /** Factory function to create engine instance */
    factory: () => ISynthEngine;

    /** Parameter labels for this engine */
    paramLabels: Record<string, string>;

    /** Theme colors for this engine */
    theme: EngineTheme;

    /** Default state values (optional, uses global defaults if not provided) */
    defaultState?: Partial<SynthState>;
}

/**
 * Registry for synth engines.
 * Allows engines to self-register, enabling addition of new engines 
 * without modifying SynthManager or App.tsx.
 */
class EngineRegistry {
    private engines = new Map<string, EngineDefinition>();

    /**
     * Register an engine definition
     */
    register(definition: EngineDefinition): void {
        if (this.engines.has(definition.name)) {
            console.warn(`Engine "${definition.name}" is already registered. Overwriting.`);
        }
        this.engines.set(definition.name, definition);
    }

    /**
     * Get an engine definition by name
     */
    get(name: string): EngineDefinition | undefined {
        return this.engines.get(name);
    }

    /**
     * Get all registered engine definitions
     */
    getAll(): EngineDefinition[] {
        return Array.from(this.engines.values());
    }

    /**
     * Get all engine names
     */
    getNames(): string[] {
        return Array.from(this.engines.keys());
    }

    /**
     * Create an instance of an engine by name
     */
    createEngine(name: string): ISynthEngine | undefined {
        const definition = this.engines.get(name);
        if (definition) {
            return definition.factory();
        }
        return undefined;
    }

    /**
     * Check if an engine is registered
     */
    has(name: string): boolean {
        return this.engines.has(name);
    }
}

// Singleton instance
export const engineRegistry = new EngineRegistry();
