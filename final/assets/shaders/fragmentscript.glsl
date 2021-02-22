#define FRAG_COLOR 0

precision highp float;
precision highp int;

uniform vec4 u_baseColorFactor;
#ifdef BASECOLOR_TEXTURE
    uniform sampler2D u_baseColorTexture;
#endif

#ifdef OCCLUSION_TEXTURE
uniform sampler2D u_occlusionTexture;
uniform float u_occlusionStrength;
#endif

#ifdef EMISSIVE_TEXTURE
uniform sampler2D u_emissiveTexture;
uniform vec3 u_emissiveFactor;
#endif

#ifdef STATIC_COLOR
    uniform vec4 u_staticColor;
#endif

in vec2 v_texture_coord;

layout(location = FRAG_COLOR) out vec4 out_color;

void main() {
    // https://github.com/KhronosGroup/glTF-Sample-Viewer/blob/master/src/shaders/pbr.frag
    #ifdef BASECOLOR_TEXTURE
        vec4 final_color = texture(u_baseColorTexture, v_texture_coord) * u_baseColorFactor;
    #else
        vec4 final_color = u_baseColorFactor;
    #endif

    #ifdef OCCLUSION_TEXTURE
        float ao = texture(u_occlusionTexture, v_texture_coord).r;
        final_color = mix(final_color, final_color * ao, u_occlusionStrength);
    #endif

    #ifdef EMISSIVE_TEXTURE
        vec3 emissive = texture(u_emissiveTexture, v_texture_coord).rgb * u_emissiveFactor;
        final_color.xyz += emissive;
    #endif

    #ifdef STATIC_COLOR
        out_color = u_staticColor;
    #else
        out_color = final_color;
    #endif
}