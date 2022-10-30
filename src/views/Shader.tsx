import { useCallback, useEffect, useRef } from "react"
import AcidJPEG from "../assets/acid_square.jpeg"

const vertexShader = /*glsl*/`
  precision lowp float;
  attribute lowp vec2 a_position;
  uniform lowp vec2 u_resolution;
  uniform lowp float u_time;
  attribute vec2 a_texcoord;

  varying lowp vec2 v_texcoord;

  void main() {
    vec2 zeroToOne = a_position / u_resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    vec2 clipSpace = zeroToTwo - 1.0;

    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_texcoord = a_texcoord;
  }
`

const fragmentShader = /*glsl*/`
  precision mediump float;
  uniform lowp vec2 u_resolution;
  uniform lowp float u_time;
  uniform sampler2D u_sampler;
  varying lowp vec2 v_texcoord;

  vec4 getPixel(vec2 position) {
    return texture2D(u_sampler, position);
  }

  float PHI = 1.61803398874989484820459;  // Φ = Golden Ratio  

  float rand(in vec2 xy, in float seed){
    return fract(tan(distance(xy*PHI, xy)*seed)*xy.x);
  }

  float FPS = 60.0;

  void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;

    float aspect = u_resolution.x / u_resolution.y;

    st.x *= aspect;

    st.x += cos(st.x * 10.0) * sin(st.y * 10.0) * sin(st.x * 10.0) * cos(st.y * 10.0);

    float onx = 1.0 / u_resolution.x;
    float ony = 1.0 / u_resolution.y;

    float seed = fract(u_time * sin(u_resolution.x) * sin(u_resolution.y));
    float scroll = mod(u_time / 10.0, FPS) / FPS;

    vec4 noise = getPixel(vec2(st.x + scroll * 1.0, st.y));

    float show = float(noise.b > 0.4);

    vec4 color = vec4(1.0 * show);
    
    color.a = 1.0;

    gl_FragColor = color;
  }
`

const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type)!

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS)

  if (success) return shader

  console.error(gl.getShaderInfoLog(shader))
  gl.deleteShader(shader)
}

const createProgram = (gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) => {
  const program = gl.createProgram()!

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  const success = gl.getProgramParameter(program, gl.LINK_STATUS)

  if (success) return program

  console.log(gl.getProgramInfoLog(program))
  gl.deleteProgram(program)
}

const HEIGHT = 1920

let renderer: number

const initWebgl = (gl: WebGL2RenderingContext) => {
  gl.canvas.width = Math.floor(window.innerWidth / window.innerHeight * HEIGHT)
  gl.canvas.height = HEIGHT
  
  const program = createProgram(
    gl,
    createShader(gl, gl.VERTEX_SHADER, vertexShader)!,
    createShader(gl, gl.FRAGMENT_SHADER, fragmentShader)!,
  )

  if (program == undefined) {
    console.error("Failed to create program")

    return
  }

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  gl.useProgram(program)

  const positionAttributeLocation = gl.getAttribLocation(program, "a_position")
  const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution")
  const timeLocation = gl.getUniformLocation(program, "u_time"); 

  let time = 0

  gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height)
  gl.uniform1f(timeLocation, time)

  {
    const positionBuffer = gl.createBuffer()

    const positions = [
      0, 0,
      gl.canvas.width, 0,
      0, gl.canvas.height,
      0, gl.canvas.height,
      gl.canvas.width, 0,
      gl.canvas.width, gl.canvas.height,
    ]

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(positionAttributeLocation)
  }

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, pixel);

  const image = new Image(gl.canvas.width, gl.canvas.height)

  image.addEventListener("load", () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  })
  
  image.src = AcidJPEG

  {
    const size = 2
    const type = gl.FLOAT
    const normalize = false
    const stride = 0
    const offset = 0

    gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset)
  }

  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  const source = new Uint8Array(gl.canvas.width * gl.canvas.height * 4)

  const render = () => {
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    gl.flush()

    // gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, source)
    
    // gl.texImage2D(
    //   gl.TEXTURE_2D, 
    //   0, 
    //   gl.RGBA, 
    //   gl.canvas.width, 
    //   gl.canvas.height, 
    //   0, 
    //   gl.RGBA, 
    //   gl.UNSIGNED_BYTE,
    //   new Uint8Array(source),
    // )

    return requestAnimationFrame(() => {
      gl.uniform1f(timeLocation, ++time)

      renderer = render()
    })
  }

  renderer = render()
}

export const Shader: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const resizeHandler = useCallback(() => {
    cancelAnimationFrame(renderer)

    initWebgl(canvasRef.current!.getContext("webgl2")!)
  }, [])

  useEffect(() => {
    if (canvasRef) {
      initWebgl(canvasRef.current!.getContext("webgl2")!)
    }

    window.addEventListener("resize", resizeHandler)

    return () => {
      cancelAnimationFrame(renderer)

      window.removeEventListener("resize", resizeHandler)
    }
  }, [canvasRef])
  
  return (
    <canvas ref={canvasRef}></canvas>
  )
}
