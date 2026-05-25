#include <iostream>
#include <stdio.h>
#include <fstream>
#include <string>
#include <cmath>
#include <unordered_map>
#include "stb_image.h"

// GLFW & GLEW include
#include <GL/glew.h>
#include <GLFW/glfw3.h>
//#include </usr/include/GLFW/glfw3.h>
//#include <GLES2/gl2.h>
//#include <EGL/egl.h>
// OpenGL Mathematics
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include "glHelper.h"
#include "Window.h"
#include "Shader.h"
#include "Camera.h"
#include "Controller.h"
#include "Texture.h"


using namespace std;
const float screen = 1920.0f/1080.0f;


const unsigned int shaderCount = 2;
const char* shaderList[shaderCount] = {
    "main.vert",
    "main.frag"
};


//(-1.62917,-0.0203968);


void key_callback(GLFWwindow* window, int key, int scancode, int action, int mods){
    if(key == GLFW_KEY_SPACE && action == GLFW_PRESS){
        cout << "SPACE!\n";
    }
}

struct Shape {
    GLuint type;
    glm::vec3 pos;
    glm::vec3 size;
};


int main(int argc, char** argv){

    _width = 1920/4;
    _height = 1080/4;

    // Starts glfw
    if(setUpGL()){
        cout << "INIT SUCCESSFUL\n"; 
    }else{
        cout << "FAILED INIT\n"; 
        return 1;
    }

    // Create Window object
    // 1920x1080
    Window mainWindow((float)(_width),(float)(_height),"winow");//800*screen,800,"mainWindow");
    if(mainWindow.getWindow() == NULL){
        glfwTerminate();
        return 1;
    }

    glfwSetKeyCallback(mainWindow.getWindow(), key_callback);

    // Initiate GLEW
    if (glewInit() != GLEW_OK) {
        cerr << "Failed to initialize GLEW\n";
        return 1;
    }
    std::cout << "OpenGL version: " << glGetString(GL_VERSION) << std::endl;


    // Set up quad
    float vertices[] = {
        -1.0f, -1.0f,
         1.0f, -1.0f,
         1.0f,  1.0f,
         1.0f,  1.0f,
        -1.0f,  1.0f,
        -1.0f, -1.0f
    };
    // Create buffer
    unsigned int triangleVBO;
    glGenBuffers(1,&triangleVBO);

    // Create Vertex Array Object (VAO)
    unsigned int triangleVAO;
    glGenVertexArrays(1,&triangleVAO);

    // Copy data to buffer
    glBindVertexArray(triangleVAO);
    glBindBuffer(GL_ARRAY_BUFFER,triangleVBO);
    glBufferData(GL_ARRAY_BUFFER,sizeof(vertices),vertices,GL_STATIC_DRAW);

    // ray marching shader
    Shader rayMarching(shaderList, shaderCount);

    // Link data buffer -> shader
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 2*sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);


    float deltaTime = 0;
    float lastTime = glfwGetTime();
    int step = 0;


    /* Render loop */
    // Check if window has closed
    while(!mainWindow.isClosed()){

        float cTime = glfwGetTime();
        deltaTime = cTime - lastTime;
        lastTime = cTime;
        if(++step % 16 == 0) cout << 1.0f/deltaTime << " FPS\n";

        // input processing
        if(mainWindow.getInput(GLFW_KEY_ESCAPE) == GLFW_PRESS){
            mainWindow.close();
            cout << "Closed\n";
            break;
        }
        

        mainWindow.clear(0.2f,0.3f,0.3f);

        // Render triangle
        rayMarching.use();

        rayMarching.setFloat("width",_width);
        rayMarching.setFloat("height",_height);

        rayMarching.setFloat("time",glfwGetTime());

        glm::mat4 rotMat = glm::mat4(1.0f);
        rotMat = glm::rotate(rotMat,(float)glfwGetTime(),glm::vec3(0.0f,0.0f,1.0f));
        rayMarching.setMat4f("rotation",rotMat);

        glm::mat4 orientationMat = glm::mat4(); // Identity
        //orientationMat = glm::rotate(orientationMat,(float)glfwGetTime(),glm::normalize(glm::vec3(1.0f,1.0f,0.0)));
        rayMarching.setMat4f("orientation",orientationMat);

        glBindVertexArray(triangleVAO);
        glDrawArrays(GL_TRIANGLES, 0, 6);

        mainWindow.render();
    }

    // Clean glfw resources
    cout << "Closing GLFW\n";
    glfwTerminate();
    cout << "GLFW Closed\n";

    return 0;
}
