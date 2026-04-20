/**
 * One-time pixi class registration for @pixi/react JSX elements.
 * Import this module once at the app root before any pixi JSX is rendered.
 */

import { extend } from '@pixi/react';
import { Container, Graphics, Sprite, Text, AnimatedSprite } from 'pixi.js';
import { Viewport } from 'pixi-viewport';

extend({ Container, Graphics, Sprite, Text, AnimatedSprite, Viewport });
