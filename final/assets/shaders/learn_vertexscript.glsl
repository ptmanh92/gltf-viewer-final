#version 300 es
precision highp float;

in vec4 a_position;
in vec3 a_color;

uniform mat4 u_transformation;

out vec3 fragColor;

void main() {
    fragColor = a_color;
    gl_Position = u_transformation * a_position;
}